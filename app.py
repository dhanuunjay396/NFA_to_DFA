"""
app.py — Flask server for NFA → DFA → Minimized DFA Simulator
"""

import os
import traceback
from flask import Flask, render_template, request, jsonify
from nfa import NFA
from subset_construction import nfa_to_dfa
from minimizer import minimize_dfa

app = Flask(__name__)

# limit request size so someone can't send huge payloads
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

# cap input string length for simulation
MAX_STRING_LENGTH = 500


def get_json_or_error():
    # helper to safely read JSON body
    data = request.get_json(silent=True)

    if data is None:
        return None, (jsonify({
            'success': False,
            'error': 'Invalid or missing JSON body. Use application/json.'
        }), 400)

    return data, None


def validate_dfa(dfa):
    # basic structure check
    required = ['states', 'alphabet', 'transitions', 'start_state', 'accept_states']
    missing = [k for k in required if k not in dfa]

    if missing:
        raise ValueError(f'DFA missing fields: {missing}')

    states = set(dfa['states'])
    alphabet = set(dfa['alphabet'])
    transitions = dfa['transitions']

    if dfa['start_state'] not in states:
        raise ValueError("Invalid start state in DFA")

    for s in dfa['accept_states']:
        if s not in states:
            raise ValueError(f'Invalid accept state "{s}"')

    # check transitions are valid and deterministic
    for state, sym_map in transitions.items():
        if state not in states:
            raise ValueError(f'Unknown state "{state}"')

        if not isinstance(sym_map, dict):
            raise ValueError(f'Invalid transition map for "{state}"')

        for sym, nxt in sym_map.items():
            if sym not in alphabet:
                raise ValueError(f'Invalid symbol "{sym}"')

            if not isinstance(nxt, str):
                raise ValueError(f'Non-deterministic transition at "{state}"')

            if nxt not in states:
                raise ValueError(f'Invalid transition target "{nxt}"')


def simulate_nfa(nfa, string):
    # start from epsilon-closure of start state
    current, _ = nfa.epsilon_closure({nfa.start_state})
    path = [{'states': sorted(current), 'symbol': None}]

    for char in string:
        moved = nfa.move(current, char)

        # no transition → dead path
        if not moved:
            path.append({'states': ['∅'], 'symbol': char})
            return {'accepted': False, 'path': path}

        current, _ = nfa.epsilon_closure(moved)
        path.append({'states': sorted(current), 'symbol': char})

    accepted = bool(current & nfa.accept_states)
    return {'accepted': accepted, 'path': path}


def simulate_dfa(dfa_dict, string):
    # DFA is strict: every symbol must have a transition
    current = dfa_dict['start_state']
    transitions = dfa_dict['transitions']
    accept = set(dfa_dict['accept_states'])

    path = [{'state': current, 'symbol': None}]

    for char in string:
        current = transitions[current][char]
        path.append({'state': current, 'symbol': char})

    accepted = current in accept
    return {'accepted': accepted, 'path': path}


@app.route('/')
def index():
    # main UI
    return render_template('index.html')


@app.route('/convert', methods=['POST'])
def convert():
    data, err = get_json_or_error()
    if err:
        return err

    try:
        nfa_data = data.get('nfa', {})

        # quick check before building NFA object
        required = ['states', 'alphabet', 'transitions', 'start_state', 'accept_states']
        missing = [k for k in required if k not in nfa_data]

        if missing:
            return jsonify({'success': False, 'error': f'Missing fields: {missing}'}), 400

        nfa = NFA.from_dict(nfa_data)

        # convert and minimize
        dfa_dict, dfa_steps = nfa_to_dfa(nfa)
        min_dfa_dict, min_steps = minimize_dfa(dfa_dict)

        return jsonify({
            'success': True,
            'nfa': nfa.to_dict(),
            'dfa': dfa_dict,
            'min_dfa': min_dfa_dict,
            'dfa_steps': dfa_steps,
            'min_steps': min_steps,
        })

    except ValueError as e:
        # expected input/validation errors
        return jsonify({'success': False, 'error': str(e)}), 400

    except Exception:
        # unexpected failure → log and return generic error
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Internal server error during conversion.'}), 500


@app.route('/simulate', methods=['POST'])
def simulate():
    data, err = get_json_or_error()
    if err:
        return err

    try:
        required_keys = ['nfa', 'dfa', 'min_dfa']
        missing = [k for k in required_keys if k not in data]

        if missing:
            return jsonify({'success': False, 'error': f'Missing fields: {missing}'}), 400

        input_string = data.get('string', '')

        if len(input_string) > MAX_STRING_LENGTH:
            return jsonify({
                'success': False,
                'error': f'Input too long (max {MAX_STRING_LENGTH})'
            }), 400

        nfa = NFA.from_dict(data['nfa'])
        dfa_dict = data['dfa']
        min_dfa_dict = data['min_dfa']

        # validate DFA inputs before using them
        validate_dfa(dfa_dict)
        validate_dfa(min_dfa_dict)

        # ensure input string only uses allowed symbols   
        alphabet = set(dfa_dict['alphabet'])
        for ch in input_string:
            if ch not in alphabet:
                return jsonify({
                    'success': False,
                    'error': f'Invalid symbol "{ch}" not in alphabet.'
                }), 400

        nfa_result = simulate_nfa(nfa, input_string)
        dfa_result = simulate_dfa(dfa_dict, input_string)
        min_result = simulate_dfa(min_dfa_dict, input_string)

        return jsonify({
            'success': True,
            'string': input_string,
            'nfa': nfa_result,
            'dfa': dfa_result,
            'min_dfa': min_result,
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    except Exception:
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Internal server error during simulation.'}), 500


if __name__ == '__main__':
    # debug only if explicitly enabled (safe default)
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    if debug_mode:
        print("Running in debug mode")

    print("=" * 50)
    print("  NFA → DFA → Minimized DFA Simulator")
    print("  http://localhost:5000")
    print("=" * 50)

    app.run(debug=debug_mode, port=5000)
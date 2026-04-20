"""
subset_construction.py — Convert NFA to DFA using subset construction
"""

from collections import deque

MAX_DFA_STATES = 256


def state_name(fs):
    # simple readable name for a DFA state (set of NFA states)
    return '{' + ', '.join(sorted(fs)) + '}'


def nfa_to_dfa(nfa):
    # make sure the NFA itself is valid before starting
    nfa.validate()

    alphabet = sorted(nfa.alphabet)

    # sanity check: transitions shouldn't contain unexpected symbols
    for state, sym_map in nfa.transitions.items():
        for sym in sym_map:
            if sym != nfa.EPSILON and sym not in alphabet:
                raise ValueError(f'Unexpected symbol "{sym}" in NFA transitions')

    steps = []

    # start with ε-closure of the start state
    start_closure, eps_steps = nfa.epsilon_closure({nfa.start_state})
    steps.extend(eps_steps)

    start_name = state_name(start_closure)

    steps.append({
        'type': 'epsilon_closure',
        'description': f'ε-closure({{{nfa.start_state}}}) = {start_name}',
        'states': sorted(start_closure),
    })

    # mapping: frozenset → name
    dfa_states = {start_closure: start_name}
    dfa_transitions = {}
    dfa_accept = set()

    queue = deque([start_closure])

    # if any NFA state inside is accepting → DFA state is accepting
    if start_closure & nfa.accept_states:
        dfa_accept.add(start_name)

    dead = '∅'
    dead_added = False

    # process states one by one (BFS style)
    while queue:
        current_set = queue.popleft()
        current_name = dfa_states[current_set]

        # guard against state explosion
        if len(dfa_states) > MAX_DFA_STATES:
            raise ValueError(
                f'DFA state explosion: exceeded {MAX_DFA_STATES} states.'
            )

        dfa_transitions.setdefault(current_name, {})

        steps.append({
            'type': 'process_state',
            'description': f'Processing DFA state {current_name}',
            'dfa_state': current_name,
            'nfa_states': sorted(current_set),
        })

        for symbol in alphabet:
            moved = nfa.move(current_set, symbol)

            # no reachable states → go to dead state
            if not moved:
                dfa_transitions[current_name][symbol] = dead

                steps.append({
                    'type': 'transition',
                    'description': f'move({current_name}, {symbol}) = ∅',
                    'from': current_name,
                    'symbol': symbol,
                    'to': dead,
                })

                # add dead state once and make it loop to itself
                if not dead_added:
                    dfa_transitions[dead] = {s: dead for s in alphabet}
                    dead_added = True

                continue

            # take ε-closure after move
            closure, eps_steps_inner = nfa.epsilon_closure(moved)
            steps.extend(eps_steps_inner)

            closure_name = state_name(closure)

            # if new DFA state, register and process later
            if closure not in dfa_states:
                dfa_states[closure] = closure_name
                queue.append(closure)

                if closure & nfa.accept_states:
                    dfa_accept.add(closure_name)

            dfa_transitions[current_name][symbol] = closure_name

            steps.append({
                'type': 'transition',
                'description': f'move({current_name}, {symbol}) → {closure_name}',
                'from': current_name,
                'symbol': symbol,
                'to': closure_name,
            })

    # collect all DFA states
    all_states = set(dfa_states.values())

    if dead_added:
        all_states.add(dead)

    all_states = sorted(all_states)

    # build table for frontend display
    table = []
    for s in all_states:
        row = {
            'state': s,
            'is_accept': s in dfa_accept,
            'is_start': s == start_name,
        }

        for sym in alphabet:
            row[sym] = dfa_transitions.get(s, {}).get(sym, dead)

        table.append(row)

    # final DFA structure
    dfa_dict = {
        'states': all_states,
        'alphabet': alphabet,
        'transitions': dfa_transitions,
        'start_state': start_name,
        'accept_states': sorted(dfa_accept),
        'table': table,
    }

    steps.append({
        'type': 'done',
        'description': f'DFA constructed with {len(all_states)} states',
    })

    return dfa_dict, steps
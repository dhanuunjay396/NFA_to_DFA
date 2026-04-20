"""
nfa.py — NFA structure + epsilon-closure logic

states: strings
symbols: strings (ε handled separately, NOT part of alphabet)
transitions: {state: {symbol: set(states)}}
"""


class NFA:
    EPSILON = 'ε'

    MAX_STATES = 100
    MAX_TRANSITIONS = 500

    def __init__(self):
        self.states = set()
        self.alphabet = set()
        self.transitions = {}
        self.start_state = None
        self.accept_states = set()
        self._transition_count = 0

    def add_state(self, state, is_start=False, is_accept=False):
        # keep states simple: non-empty strings only
        if not isinstance(state, str) or state == "":
            raise ValueError("State must be a non-empty string")

        # only enforce limit when it's actually a new state
        if state not in self.states and len(self.states) >= self.MAX_STATES:
            raise ValueError(f'Max states limit ({self.MAX_STATES}) exceeded')

        self.states.add(state)

        # allow exactly one start state
        if is_start:
            if self.start_state is not None and self.start_state != state:
                raise ValueError("Multiple start states not allowed")
            self.start_state = state

        if is_accept:
            self.accept_states.add(state)

    def add_transition(self, from_state, symbol, to_state):
        # transitions only between known string states
        if not isinstance(from_state, str) or not isinstance(to_state, str):
            raise ValueError("States must be strings")

        if from_state == "" or to_state == "":
            raise ValueError("States cannot be empty strings")

        if from_state not in self.states:
            raise ValueError(f'Unknown state "{from_state}"')

        if to_state not in self.states:
            raise ValueError(f'Unknown state "{to_state}"')

        if not isinstance(symbol, str):
            raise ValueError("Symbol must be a string")

        if symbol == "":
            raise ValueError("Symbol cannot be empty string")

        # alphabet is treated as the source of truth
        if symbol != self.EPSILON and symbol not in self.alphabet:
            raise ValueError(f'Symbol "{symbol}" not in alphabet')

        self.transitions.setdefault(from_state, {})
        self.transitions[from_state].setdefault(symbol, set())

        # only count new transitions (sets already avoid duplicates)
        if to_state not in self.transitions[from_state][symbol]:
            if self._transition_count >= self.MAX_TRANSITIONS:
                raise ValueError(
                    f'Too many transitions. Max allowed = {self.MAX_TRANSITIONS}'
                )

            self.transitions[from_state][symbol].add(to_state)
            self._transition_count += 1

    def validate(self):
        # basic structure checks
        if self.start_state is None:
            raise ValueError('No start state defined.')

        if self.start_state not in self.states:
            raise ValueError(
                f'Start state "{self.start_state}" not in states.'
            )

        for s in self.accept_states:
            if s not in self.states:
                raise ValueError(
                    f'Accept state "{s}" not in states.'
                )

        # verify transitions are consistent
        for state, sym_map in self.transitions.items():
            if state not in self.states:
                raise ValueError(f'Transition from unknown state "{state}"')

            for symbol, targets in sym_map.items():
                if symbol != self.EPSILON and symbol not in self.alphabet:
                    raise ValueError(f'Invalid symbol "{symbol}" in transitions')

                for target in targets:
                    if target not in self.states:
                        raise ValueError(f'Transition to unknown state "{target}"')

    def epsilon_closure(self, states):
        # standard epsilon-closure using a stack
        if not states:
            return frozenset(), []

        closure = set(states)
        stack = list(states)
        steps = []

        # log starting points (useful for UI/visualization)
        for s in states:
            steps.append({
                'from': None,
                'to': s,
                'symbol': 'ε',
                'type': 'start'
            })

        while stack:
            state = stack.pop()

            eps_targets = self.transitions.get(state, {}).get(self.EPSILON, set())

            for target in eps_targets:
                if target not in closure:
                    closure.add(target)
                    stack.append(target)

                    steps.append({
                        'from': state,
                        'to': target,
                        'symbol': 'ε',
                        'type': 'transition'
                    })

        return frozenset(closure), steps

    def move(self, states, symbol):
        # follow a symbol from a set of states
        result = set()

        for state in states:
            targets = self.transitions.get(state, {}).get(symbol, set())
            result.update(targets)

        return frozenset(result)

    def get_reachable_states(self):
        # simple DFS to find reachable states from start
        visited = set()
        stack = [self.start_state]

        while stack:
            s = stack.pop()
            if s not in visited:
                visited.add(s)
                for sym_map in self.transitions.get(s, {}).values():
                    stack.extend(sym_map)

        return visited

    def to_dict(self):
        # convert to JSON-friendly structure
        trans = {
            state: {sym: list(targets) for sym, targets in sym_map.items()}
            for state, sym_map in self.transitions.items()
        }

        return {
            'states': list(self.states),
            'alphabet': list(self.alphabet),
            'transitions': trans,
            'start_state': self.start_state,
            'accept_states': list(self.accept_states),
        }

    @staticmethod
    def from_dict(data):
        # basic structure validation first
        required = ['states', 'alphabet', 'transitions', 'start_state', 'accept_states']
        missing = [k for k in required if k not in data]

        if missing:
            raise ValueError(f'Missing fields: {missing}')

        if not isinstance(data['states'], list) or not data['states']:
            raise ValueError('"states" must be a non-empty list')

        if len(data['states']) != len(set(data['states'])):
            raise ValueError("Duplicate states are not allowed")

        if not isinstance(data['alphabet'], list):
            raise ValueError('"alphabet" must be a list')

        if len(data['alphabet']) != len(set(data['alphabet'])):
            raise ValueError("Duplicate symbols in alphabet are not allowed")

        if not all(isinstance(sym, str) for sym in data['alphabet']):
            raise ValueError("All alphabet symbols must be strings")

        if NFA.EPSILON in data['alphabet']:
            raise ValueError("Alphabet must not contain epsilon (ε)")

        if len(data['states']) > NFA.MAX_STATES:
            raise ValueError("Too many states in input")

        if not isinstance(data['transitions'], dict):
            raise ValueError('"transitions" must be a dict')

        if not isinstance(data['accept_states'], list):
            raise ValueError('"accept_states" must be a list')

        if not isinstance(data['start_state'], str):
            raise ValueError('"start_state" must be a string')

        nfa = NFA()

        # add states first so everything else can rely on them
        for state in data['states']:
            nfa.add_state(state)

        if data['start_state'] not in nfa.states:
            raise ValueError("Start state must be one of the defined states")
        nfa.start_state = data['start_state']

        for s in data['accept_states']:
            if s not in nfa.states:
                raise ValueError(f'Accept state "{s}" not in states')
        nfa.accept_states = set(data['accept_states'])

        # alphabet is fixed once here
        nfa.alphabet = set(data['alphabet'])

        # rebuild transitions safely
        for state, sym_map in data['transitions'].items():
            if state not in nfa.states:
                raise ValueError(f'Transition from unknown state "{state}"')

            if not isinstance(sym_map, dict):
                raise ValueError(f'Invalid transitions for state "{state}"')

            for symbol, targets in sym_map.items():
                if not isinstance(symbol, str) or symbol == "":
                    raise ValueError("Symbol must be a non-empty string")

                if symbol != NFA.EPSILON and symbol not in nfa.alphabet:
                    raise ValueError(f'Symbol "{symbol}" not in alphabet')

                if not isinstance(targets, list):
                    raise ValueError(
                        f'Targets for ({state}, {symbol}) must be a list'
                    )

                for target in targets:
                    if not isinstance(target, str):
                        raise ValueError("Target state must be a string")

                    nfa.add_transition(state, symbol, target)

        nfa.validate()
        return nfa
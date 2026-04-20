"""
minimizer.py — DFA minimization using Hopcroft's algorithm
"""

from collections import deque

MAX_ITERATIONS = 10_000


def _format_group(group):
    return '{' + ', '.join(sorted(group)) + '}'


def _build_state_to_part(partitions):
    # build quick lookup: state → partition index
    mapping = {}
    for i, part in enumerate(partitions):
        for s in part:
            mapping[s] = i
    return mapping


def minimize_dfa(dfa_dict):
    # basic structure validation first
    required = ['states', 'alphabet', 'transitions', 'start_state', 'accept_states']
    missing = [k for k in required if k not in dfa_dict]
    if missing:
        raise ValueError(f'DFA dict missing required fields: {missing}')

    states = set(dfa_dict['states'])
    alphabet = sorted(set(dfa_dict['alphabet']))  # keep order consistent
    transitions = dfa_dict['transitions']
    start = dfa_dict['start_state']
    accept = set(dfa_dict['accept_states'])

    if not states:
        raise ValueError("States cannot be empty")

    if start not in states:
        raise ValueError("Start state not in states")

    for s in accept:
        if s not in states:
            raise ValueError(f'Accept state "{s}" not in states')

    # make sure transitions are valid and deterministic
    for s, sym_map in transitions.items():
        if s not in states:
            raise ValueError(f'Transition from unknown state "{s}"')

        if not isinstance(sym_map, dict):
            raise ValueError(f'Invalid transition map for state "{s}"')

        for sym, nxt in sym_map.items():
            if sym not in alphabet:
                raise ValueError(f'Unexpected symbol "{sym}" in transitions')

            # DFA must go to exactly one state
            if not isinstance(nxt, str):
                raise ValueError(f'DFA transition must be a single state, got {nxt}')

            if nxt not in states:
                raise ValueError(f'Transition to unknown state "{nxt}"')

    # ensure DFA is complete (no missing transitions)
    for s in states:
        for sym in alphabet:
            if sym not in transitions.get(s, {}):
                raise ValueError(
                    f'Missing transition for state "{s}" on symbol "{sym}"'
                )

    steps = []

    # remove unreachable states first (no point minimizing them)
    reachable = set()
    queue = deque([start])

    while queue:
        s = queue.popleft()
        if s in reachable:
            continue

        reachable.add(s)

        for sym in alphabet:
            nxt = transitions[s][sym]
            if nxt not in reachable:
                queue.append(nxt)

    unreachable = states - reachable

    steps.append({
        'type': 'unreachable',
        'description': (
            f'Removed {len(unreachable)} unreachable states: '
            f'{_format_group(unreachable)}'
            if unreachable else "No unreachable states found."
        ),
        'removed': sorted(unreachable),
    })

    states = reachable
    accept = accept & reachable

    # initial split: accepting vs non-accepting
    non_accept = states - accept
    partitions = []

    if accept:
        partitions.append(frozenset(accept))
    if non_accept:
        partitions.append(frozenset(non_accept))

    steps.append({
        'type': 'initial_partition',
        'description': (
            f'Accept={_format_group(accept)} | '
            f'Non-accept={_format_group(non_accept)}'
        ),
        'partitions': [sorted(p) for p in partitions],
    })

    # refine partitions until nothing changes
    iteration = 0
    changed = True
    split_label = 0

    while changed:
        iteration += 1
        if iteration > MAX_ITERATIONS:
            raise ValueError("Minimization exceeded safe iteration limit")

        changed = False
        new_partitions = []
        state_to_part = _build_state_to_part(partitions)

        for group in partitions:
            # single-state groups are already minimal
            if len(group) == 1:
                new_partitions.append(group)
                continue

            split_done = False

            for sym in alphabet:
                sig = {}

                # group states based on where they go on this symbol
                for state in group:
                    nxt = transitions[state][sym]
                    sig[state] = state_to_part[nxt]

                grouped = {}
                for st, key in sig.items():
                    grouped.setdefault(key, set()).add(st)

                # if behavior differs → split
                if len(grouped) > 1:
                    split_label += 1
                    sub_groups = [frozenset(g) for g in grouped.values()]
                    new_partitions.extend(sub_groups)

                    steps.append({
                        'type': 'split',
                        'description': (
                            f'Split #{split_label} on "{sym}" → '
                            + ' | '.join(_format_group(sg) for sg in sub_groups)
                        ),
                        'original': sorted(group),
                        'symbol': sym,
                        'result': [sorted(sg) for sg in sub_groups],
                    })

                    changed = True
                    split_done = True
                    break

            if not split_done:
                new_partitions.append(group)

        partitions = new_partitions

    # build minimized DFA from partitions
    rep = {p: sorted(p)[0] for p in partitions}

    state_to_rep = {}
    for p in partitions:
        r = rep[p]
        for s in p:
            state_to_rep[s] = r

    new_states = sorted(set(state_to_rep.values()))
    new_start = state_to_rep[start]
    new_accept = {state_to_rep[s] for s in accept}

    new_transitions = {}

    for p in partitions:
        r = rep[p]
        new_transitions[r] = {}

        # pick any state in the group (they behave the same now)
        state = next(iter(p))

        for sym in alphabet:
            nxt = transitions[state][sym]
            new_transitions[r][sym] = state_to_rep[nxt]

    # build table for frontend
    table = []
    for s in new_states:
        row = {
            'state': s,
            'is_accept': s in new_accept,
            'is_start': s == new_start,
        }

        for sym in alphabet:
            row[sym] = new_transitions[s][sym]

        table.append(row)

    min_dfa = {
        'states': new_states,
        'alphabet': alphabet,
        'transitions': new_transitions,
        'start_state': new_start,
        'accept_states': list(new_accept),
        'table': table,
        'merged_groups': [sorted(p) for p in partitions if len(p) > 1],
    }

    steps.append({
        'type': 'done',
        'description': (
            f'Minimization complete → {len(new_states)} states (from {len(states)})'
        ),
    })

    return min_dfa, steps
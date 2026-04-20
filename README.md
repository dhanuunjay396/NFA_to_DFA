# NFA → DFA Converter & Minimizer

A web-based simulator that converts Non-deterministic Finite Automata (NFA) to Deterministic Finite Automata (DFA) and then minimizes the DFA — built with Python (Flask) for a Theory of Computation course project.

## Features

- **Visual NFA Builder** — Add states, transitions (including ε), mark start/accept states
- **NFA → DFA** — Subset Construction algorithm with step-by-step breakdown
- **DFA Minimization** — Hopcroft's algorithm with partition refinement steps
- **Three-way Graph View** — NFA | DFA | Minimized DFA side by side (Cytoscape.js)
- **Transition Tables** — Live transition tables for DFA and Min-DFA
- **String Simulator** — Test any input string through all three automata
- **Preset Examples** — ends with 'ab', even a's, contains 'aa', binary divisible by 3

## How to Run

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/nfa-dfa-converter.git
cd nfa-dfa-converter
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run
```bash
python app.py
```

### 4. Open browser
```
http://localhost:5000
```

## Project Structure

```
nfa_dfa_project/
│
├── app.py                    ← Flask server + API routes
├── nfa.py                    ← NFA class, ε-closure algorithm
├── subset_construction.py    ← NFA → DFA (Subset Construction)
├── minimizer.py              ← DFA → Min-DFA (Hopcroft's Algorithm)
├── templates/
│   └── index.html            ← Frontend (HTML + CSS + JS + Cytoscape.js)
├── requirements.txt
└── README.md
```

## Algorithms Implemented

| Algorithm | File | Concept |
|---|---|---|
| ε-closure | `nfa.py` | Reachable states via epsilon transitions |
| Subset Construction | `subset_construction.py` | NFA → DFA conversion |
| Hopcroft's Algorithm | `minimizer.py` | DFA state minimization |
| String Simulation | `app.py` | Runs input strings through all automata |

## Tech Stack

- **Backend**: Python 3 + Flask
- **Frontend**: Vanilla HTML/CSS/JS
- **Graph Visualization**: Cytoscape.js (via CDN)
- **No build step required**

## Requirements

- Python 3.7+
- pip

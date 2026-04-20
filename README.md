# NFA to DFA Converter and Minimizer

A web-based application that converts a Non-deterministic Finite Automaton (NFA) into a Deterministic Finite Automaton (DFA) using the subset construction method, and further minimizes the DFA using Hopcroft's algorithm.

The project is built as part of a Theory of Computation course and includes an interactive interface for constructing automata, visualizing transitions, and simulating input strings.

## 🚀 Live Demo

👉 **https://nfa-to-dfa.onrender.com**

> Note: The app is hosted on Render's free tier. It may take up to 50 seconds to load after inactivity.

---

## Overview

The application allows users to:

* Define an NFA with states, transitions, start state, and accept states
* Convert the NFA into an equivalent DFA
* Minimize the resulting DFA
* Simulate input strings on NFA, DFA, and minimized DFA
* Visualize automata using graph-based representations

---

## Features

* Interactive NFA construction
* Support for epsilon (ε) transitions
* Subset construction algorithm for NFA to DFA conversion
* Hopcroft's algorithm for DFA minimization
* Step-by-step computation tracking
* String simulation across all automata
* Graph visualization using Cytoscape.js
* Transition table generation
* Export automata as PNG and JSON

---

## Technologies Used

* Python (Flask)
* HTML, CSS, JavaScript
* Cytoscape.js for graph visualization
* Gunicorn for production server
* Render for deployment

---

## Project Structure

```
NFA_to_DFA/
├── app.py
├── nfa.py
├── subset_construction.py
├── minimizer.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── app.js
├── requirements.txt
└── README.md
```

---

## Running Locally

1. Clone the repository:

```
git clone https://github.com/dhanuunjay396/NFA_to_DFA.git
cd NFA_to_DFA
```

2. Install dependencies:

```
pip install -r requirements.txt
```

3. Run the application:

```
python app.py
```

4. Open a browser and go to:

```
http://localhost:5000
```

---

## Deployment

This project is deployed on **Render**: https://nfa-to-dfa.onrender.com

To deploy your own instance:

1. Push the repo to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Use the following configuration:

| Field | Value |
|---|---|
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn app:app` |
| **Environment Variable** | `FLASK_DEBUG=false` |

---

## Algorithms Implemented

* Epsilon-closure computation
* Subset construction (NFA to DFA conversion)
* Hopcroft's algorithm for DFA minimization
* String simulation on finite automata

---

## Notes

* Input size is limited to ensure performance and stability
* DFA validation is performed before simulation
* The application is designed for educational and demonstration purposes

---

## Author

**Dhanuunjay Reddy**  
[GitHub](https://github.com/dhanuunjay396)

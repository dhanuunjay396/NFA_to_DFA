/**
 * app.js — NFA → DFA Converter Frontend
 * Features: graph viz, simulation animation, export, dark/light theme
 */

(function () {
  'use strict';

  /* ============================================================
     1. APPLICATION STATE
     ============================================================ */
  const statesMap = {};       // { name: { is_start, is_accept } }
  const transList = [];       // [{ from, symbol, to }]
  let nfaData   = null;
  let dfaData   = null;
  let minDfaData = null;
  let cyNFA = null, cyDFA = null, cyMin = null;

  /* ============================================================
     2. PRESETS
     ============================================================ */
  const PRESETS = {
    ends_ab: {
      label: "Ends with 'ab'",
      states: {
        q0: { is_start: true,  is_accept: false },
        q1: { is_start: false, is_accept: false },
        q2: { is_start: false, is_accept: true  }
      },
      transitions: [
        { from: 'q0', symbol: 'a', to: 'q0' },
        { from: 'q0', symbol: 'b', to: 'q0' },
        { from: 'q0', symbol: 'a', to: 'q1' },
        { from: 'q1', symbol: 'b', to: 'q2' }
      ]
    },
    even_a: {
      label: "Even number of a's",
      states: {
        q0: { is_start: true,  is_accept: true  },
        q1: { is_start: false, is_accept: false }
      },
      transitions: [
        { from: 'q0', symbol: 'a', to: 'q1' },
        { from: 'q1', symbol: 'a', to: 'q0' },
        { from: 'q0', symbol: 'b', to: 'q0' },
        { from: 'q1', symbol: 'b', to: 'q1' }
      ]
    },
    contains_aa: {
      label: "Contains 'aa'",
      states: {
        q0: { is_start: true,  is_accept: false },
        q1: { is_start: false, is_accept: false },
        q2: { is_start: false, is_accept: true  }
      },
      transitions: [
        { from: 'q0', symbol: 'a', to: 'q0' },
        { from: 'q0', symbol: 'b', to: 'q0' },
        { from: 'q0', symbol: 'a', to: 'q1' },
        { from: 'q1', symbol: 'a', to: 'q2' },
        { from: 'q2', symbol: 'a', to: 'q2' },
        { from: 'q2', symbol: 'b', to: 'q2' }
      ]
    },
    binary_div3: {
      label: 'Binary divisible by 3',
      states: {
        r0: { is_start: true,  is_accept: true  },
        r1: { is_start: false, is_accept: false },
        r2: { is_start: false, is_accept: false }
      },
      transitions: [
        { from: 'r0', symbol: '0', to: 'r0' },
        { from: 'r0', symbol: '1', to: 'r1' },
        { from: 'r1', symbol: '0', to: 'r2' },
        { from: 'r1', symbol: '1', to: 'r0' },
        { from: 'r2', symbol: '0', to: 'r1' },
        { from: 'r2', symbol: '1', to: 'r2' }
      ]
    }
  };

  /* ============================================================
     3. CYTOSCAPE STYLE FACTORY
     State colour scheme:
       Initial/Start   → Red    #FF4040
       Final/Accept    → Green  #3DFF6A
       Start + Final   → Red border, green underlay
       Intermediate    → Yellow #FFB800
       Trap / Dead (∅) → Blue   #4488FF
     ============================================================ */
  function getCyStyle(nodeColor, edgeColor) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bgColor   = isDark ? '#070914' : '#EEF2FC';
    const textColor = isDark ? '#E8ECFA' : '#1A1F35';

    return [
      /* --- Default node (intermediate) → Yellow --- */
      {
        selector: 'node',
        style: {
          'background-color': isDark ? 'rgba(255,184,0,0.08)' : 'rgba(200,140,0,0.07)',
          'border-width': 2,
          'border-color': '#FFB800',
          'label': 'data(label)',
          'color': textColor,
          'font-family': 'Share Tech Mono, monospace',
          'font-size': '11px',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 50, 'height': 50,
          'text-outline-width': 2,
          'text-outline-color': bgColor,
        }
      },
      /* --- Initial/Start state → Red --- */
      {
        selector: 'node[node_type="start"]',
        style: {
          'border-color': '#FF4040',
          'border-width': 3,
          'background-color': isDark ? 'rgba(255,64,64,0.12)' : 'rgba(220,40,40,0.09)',
        }
      },
      /* --- Final/Accept state → Green with double-ring --- */
      {
        selector: 'node[node_type="final"]',
        style: {
          'border-width': 4,
          'border-color': '#3DFF6A',
          'background-color': isDark ? 'rgba(61,255,106,0.10)' : 'rgba(30,200,60,0.08)',
          'underlay-color': '#3DFF6A',
          'underlay-padding': 5,
          'underlay-opacity': 0.22,
          'underlay-shape': 'ellipse',
        }
      },
      /* --- Start + Final (both) → Red border, green underlay --- */
      {
        selector: 'node[node_type="startfinal"]',
        style: {
          'border-color': '#FF4040',
          'border-width': 4,
          'background-color': isDark ? 'rgba(255,64,64,0.10)' : 'rgba(220,40,40,0.08)',
          'underlay-color': '#3DFF6A',
          'underlay-padding': 5,
          'underlay-opacity': 0.22,
          'underlay-shape': 'ellipse',
        }
      },
      /* --- Trap / Dead state → Blue --- */
      {
        selector: 'node[node_type="trap"]',
        style: {
          'border-color': '#4488FF',
          'border-width': 2,
          'background-color': isDark ? 'rgba(68,136,255,0.10)' : 'rgba(40,100,220,0.08)',
        }
      },
      /* --- Edges --- */
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'color': isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
          'font-size': '10px',
          'font-family': 'Share Tech Mono, monospace',
          'text-background-color': bgColor,
          'text-background-opacity': 1,
          'text-background-padding': '3px',
          'edge-text-rotation': 'autorotate',
        }
      },
      {
        selector: 'edge[label="ε"], edge[label="ε, *"]',
        style: {
          'line-style': 'dashed',
          'line-color': 'rgba(255,184,0,0.5)',
          'color': '#FFB800',
          'target-arrow-color': '#FFB800',
        }
      },
    ];
  }

  /* ============================================================
     4. CYTOSCAPE INIT & LAYOUT
     ============================================================ */
  const ZOOM = { minZoom: 0.15, maxZoom: 3.0, wheelSensitivity: 0.12 };

  function coselayout(animate) {
    return {
      name: 'cose',
      padding: 55,
      animate: animate !== false,
      animationDuration: 400,
      randomize: false,
      nodeRepulsion: 4500,
      idealEdgeLength: 80,
      edgeElasticity: 80,
    };
  }

  function fitGraph(cy) {
    cy.fit(null, 45);
    if (cy.zoom() > 1.3) cy.zoom({ level: 1.3, renderedPosition: cy.extent() });
  }

  function initCy() {
    cyNFA = cytoscape({
      container: document.getElementById('cy-nfa'),
      style: getCyStyle('#FFB800', '#FFB800'),
      layout: coselayout(),
      ...ZOOM,
    });
    cyNFA.on('layoutstop', () => fitGraph(cyNFA));
    renderNFAGraph();
  }

  /* ============================================================
     5. GRAPH BUILDING HELPERS
     ============================================================ */

  /**
   * Determine the node_type for colour-coding:
   *   'trap'       → dead / sink state (∅)
   *   'startfinal' → both initial and final
   *   'start'      → initial only
   *   'final'      → final only
   *   'intermediate'→ everything else
   */
  function resolveNodeType(id, info, startState, acceptStates) {
    if (id === '∅') return 'trap';

    const isStart  = !!(info.is_start  || id === startState);
    const isFinal  = !!(info.is_accept || (acceptStates || []).includes(id));

    if (isStart && isFinal) return 'startfinal';
    if (isStart)            return 'start';
    if (isFinal)            return 'final';
    return 'intermediate';
  }

  function buildElements(statesObj, edgesArr, startState, acceptStates) {
    const elements = [];

    for (const [id, info] of Object.entries(statesObj)) {
      const nodeType = resolveNodeType(id, info, startState, acceptStates);
      elements.push({
        group: 'nodes',
        data: {
          id,
          label:     id.length > 13 ? id.substring(0, 12) + '…' : id,
          is_start:  (info.is_start  || id === startState)              ? 'true' : 'false',
          is_accept: (info.is_accept || (acceptStates || []).includes(id)) ? 'true' : 'false',
          node_type: nodeType,
        }
      });
    }

    const edgeMap = {};
    for (const { from, symbol, to } of edgesArr) {
      const key = `${from}||${to}`;
      if (!edgeMap[key]) edgeMap[key] = [];
      if (!edgeMap[key].includes(symbol)) edgeMap[key].push(symbol);
    }

    let eid = 0;
    for (const [key, syms] of Object.entries(edgeMap)) {
      const [src, tgt] = key.split('||');
      const hasEps = syms.includes('ε');
      const others = syms.filter(s => s !== 'ε');
      const label  = [...(hasEps ? ['ε'] : []), ...others.sort()].join(', ');
      elements.push({
        group: 'edges',
        data: { id: 'e' + eid++, source: src, target: tgt, label }
      });
    }

    return elements;
  }

  /* Render the NFA live while user edits */
  function renderNFAGraph() {
    if (!cyNFA) return;
    cyNFA.elements().remove();

    const startState  = Object.keys(statesMap).find(k => statesMap[k].is_start) || null;
    const acceptStates = Object.keys(statesMap).filter(k => statesMap[k].is_accept);
    const edges = transList.map(t => ({ from: t.from, symbol: t.symbol, to: t.to }));

    const elements = buildElements(statesMap, edges, startState, acceptStates);
    cyNFA.add(elements);
    cyNFA.layout(coselayout(true)).run();
  }

  /* Render a complete automaton (DFA or MinDFA) into a container div */
  function renderAutomaton(containerId, autoData, nodeColor, edgeColor) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const cyDiv = document.createElement('div');
    cyDiv.style.cssText = 'width:100%;height:100%';
    container.appendChild(cyDiv);

    const edges = [];
    for (const [from, symMap] of Object.entries(autoData.transitions || {})) {
      for (const [sym, to] of Object.entries(symMap)) {
        edges.push({ from, symbol: sym, to });
      }
    }

    const statesObj = {};
    for (const s of autoData.states) statesObj[s] = { is_start: false, is_accept: false };

    const elements = buildElements(statesObj, edges, autoData.start_state, autoData.accept_states);

    const inst = cytoscape({
      container: cyDiv,
      elements,
      style: getCyStyle(nodeColor, edgeColor),
      layout: coselayout(true),
      ...ZOOM,
    });
    inst.on('layoutstop', () => fitGraph(inst));
    return inst;
  }

  /* ============================================================
     6. STATE & TRANSITION MANAGEMENT
     ============================================================ */
  window.addState = function () {
    const name = document.getElementById('stateName').value.trim();
    if (!name)           return showStatus('⚠ Enter a state name', 'warn');
    if (statesMap[name]) return showStatus(`⚠ State "${name}" already exists`, 'warn');

    const isStart = document.getElementById('radioStart').checked;
    const isFinal = document.getElementById('radioFinal').checked;

    if (isStart) {
      for (const k of Object.keys(statesMap)) statesMap[k].is_start = false;
    }

    statesMap[name] = { is_start: isStart, is_accept: isFinal };
    document.getElementById('stateName').value = '';
    document.getElementById('radioIntermediate').checked = true;

    updateStateList();
    renderNFAGraph();
    showStatus(`State [${name}] added`, 'ok');
  };

  window.deleteState = function (name) {
    delete statesMap[name];
    for (let i = transList.length - 1; i >= 0; i--) {
      if (transList[i].from === name || transList[i].to === name) transList.splice(i, 1);
    }
    updateStateList();
    updateTransList();
    renderNFAGraph();
  };

  window.addTransition = function () {
    const from = document.getElementById('transFrom').value.trim();
    const sym  = document.getElementById('transSymbol').value.trim() || 'ε';
    const to   = document.getElementById('transTo').value.trim();

    if (!from || !to) return showStatus('⚠ Fill in from/to fields', 'warn');
    if (!statesMap[from]) return showStatus(`⚠ State "${from}" not defined`, 'warn');
    if (!statesMap[to])   return showStatus(`⚠ State "${to}" not defined`, 'warn');

    const dup = transList.some(t => t.from === from && t.symbol === sym && t.to === to);
    if (dup) return showStatus('⚠ Transition already exists', 'warn');

    transList.push({ from, symbol: sym, to });
    document.getElementById('transFrom').value   = '';
    document.getElementById('transSymbol').value = '';
    document.getElementById('transTo').value     = '';

    updateTransList();
    renderNFAGraph();
    showStatus(`${from} → ${sym} → ${to}`, 'ok');
  };

  window.deleteTransition = function (idx) {
    transList.splice(idx, 1);
    updateTransList();
    renderNFAGraph();
  };

  function updateStateList() {
    const el = document.getElementById('stateList');
    el.innerHTML = '';
    for (const [name, info] of Object.entries(statesMap)) {
      let cls = 'state-tag';
      if (info.is_start)  cls += ' is-start';
      if (info.is_accept) cls += ' is-final';

      // Badge: show type
      let badge = '';
      if (info.is_start && info.is_accept) {
        badge = '<span class="tag-badge start-badge">START</span><span class="tag-badge final-badge">FINAL</span>';
      } else if (info.is_start) {
        badge = '<span class="tag-badge start-badge">START</span>';
      } else if (info.is_accept) {
        badge = '<span class="tag-badge final-badge">FINAL</span>';
      }

      const div = document.createElement('div');
      div.className = cls;
      div.innerHTML = `
        <span class="tag-name">${name}</span>
        ${badge}
        <button class="tag-del" onclick="deleteState('${name}')" title="Remove">✕</button>
      `;
      el.appendChild(div);
    }
  }

  function updateTransList() {
    const el = document.getElementById('transList');
    el.innerHTML = '';
    transList.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'trans-item';
      div.innerHTML = `
        <span class="trans-from">${t.from}</span>
        <span class="trans-arrow">─<span class="trans-sym">${t.symbol}</span>─▶</span>
        <span class="trans-to">${t.to}</span>
        <button class="tag-del" onclick="deleteTransition(${i})">✕</button>
      `;
      el.appendChild(div);
    });
  }

  /* ============================================================
     7. CONVERSION  (POST /convert)
     ============================================================ */
  window.runConversion = async function () {
    if (Object.keys(statesMap).length === 0)
      return showStatus('⚠ Add states first', 'warn');

    const nfa = {
      states:       Object.keys(statesMap),
      alphabet:     [...new Set(transList.filter(t => t.symbol !== 'ε').map(t => t.symbol))],
      transitions:  {},
      start_state:  null,
      accept_states: [],
    };

    for (const [n, info] of Object.entries(statesMap)) {
      if (info.is_start)  nfa.start_state = n;
      if (info.is_accept) nfa.accept_states.push(n);
    }

    if (!nfa.start_state)
      return showStatus('⚠ No start state defined', 'warn');

    transList.forEach(({ from, symbol, to }) => {
      nfa.transitions[from] = nfa.transitions[from] || {};
      nfa.transitions[from][symbol] = nfa.transitions[from][symbol] || [];
      nfa.transitions[from][symbol].push(to);
    });

    const btn = document.getElementById('convertBtn');
    btn.classList.add('loading');
    showStatus('Converting…', 'info');

    try {
      const res  = await fetch('/convert', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nfa }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);

      if (cyDFA) { cyDFA.destroy(); cyDFA = null; }
      if (cyMin) { cyMin.destroy(); cyMin = null; }

      cyDFA = renderAutomaton('cy-dfa', data.dfa,     '#FF2D78', '#FF2D78');
      cyMin = renderAutomaton('cy-min', data.min_dfa, '#3DFF6A', '#3DFF6A');

      setBadge('dfa-count', data.dfa.states.length);
      setBadge('min-count', data.min_dfa.states.length);

      dfaData    = data.dfa;
      minDfaData = data.min_dfa;
      nfaData    = nfa;

      renderSteps(data.dfa_steps, data.min_steps);
      renderTables(data.dfa, data.min_dfa);

      const saved = dfaData.states.length - minDfaData.states.length;
      showStatus(
        `✓ DFA: ${dfaData.states.length} states → Min-DFA: ${minDfaData.states.length} states` +
        (saved > 0 ? ` (−${saved})` : ''),
        'ok'
      );
    } catch (err) {
      showStatus('✕ ' + err.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  };

  function setBadge(id, count) {
    const el = document.getElementById(id);
    el.textContent = count;
    el.style.display = 'inline-flex';
  }

  /* ============================================================
     8. SIMULATION  (POST /simulate)
     ============================================================ */
  window.runSimulate = async function () {
    if (!dfaData) return showStatus('⚠ Run conversion first', 'warn');

    const str = document.getElementById('simInput').value;

    try {
      const res  = await fetch('/simulate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ string: str, nfa: nfaData, dfa: dfaData, min_dfa: minDfaData }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      renderSimResult(data, str);
    } catch (err) {
      showStatus('✕ ' + err.message, 'error');
    }
  };

  function renderSimResult(data, inputStr) {
    const container  = document.getElementById('simResult');
    const displayStr = inputStr === '' ? '(empty string ε)' : `"${inputStr}"`;

    const cards = [
      { title: 'NFA',     result: data.nfa,     color: '#00E5FF' },
      { title: 'DFA',     result: data.dfa,     color: '#FF2D78' },
      { title: 'Min-DFA', result: data.min_dfa, color: '#3DFF6A' },
    ];

    container.innerHTML = `
      <div class="sim-string-label">String: <strong>${displayStr}</strong></div>
      <div class="sim-cards">
        ${cards.map(c => `
          <div class="sim-card" style="--card-accent:${c.color}">
            <div class="sim-card-title">${c.title}</div>
            <div class="sim-verdict ${c.result.accepted ? 'accepted' : 'rejected'}">
              ${c.result.accepted ? '✓ ACCEPTED' : '✕ REJECTED'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ============================================================
     9. STEPS PANEL
     ============================================================ */
  function renderSteps(dfaSteps, minSteps) {
    const container = document.getElementById('stepsContent');
    container.innerHTML = '';

    const ICONS = {
      epsilon_closure:    '∊',
      process_state:      '◈',
      transition:         '→',
      done:               '✓',
      unreachable:        '✗',
      initial_partition:  '⊕',
      split:              '⊢',
    };

    const sections = [
      { title: 'Phase 1 — Subset Construction',   steps: dfaSteps, color: '#FF2D78' },
      { title: 'Phase 2 — Hopcroft Minimization', steps: minSteps, color: '#3DFF6A' },
    ];

    sections.forEach(({ title, steps, color }) => {
      if (!steps || steps.length === 0) return;

      const sec = document.createElement('div');
      sec.className = 'steps-section';
      sec.innerHTML = `<h3 class="steps-section-title" style="color:${color}">${title}</h3>`;

      steps.forEach((step, i) => {
        const item = document.createElement('div');
        item.className = `step-item step-${step.type || 'transition'}`;
        item.style.animationDelay = `${i * 0.035}s`;
        item.innerHTML = `
          <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="step-icon">${ICONS[step.type] || '·'}</span>
          <span class="step-desc">${escapeHTML(step.description)}</span>
        `;
        sec.appendChild(item);
      });

      container.appendChild(sec);
    });
  }

  /* ============================================================
     10. TABLES PANEL
     ============================================================ */
  function renderTables(dfa, minDfa) {
    const container = document.getElementById('tablesContent');
    container.innerHTML = '';

    const defs = [
      { title: 'DFA Transition Table',           data: dfa,    color: '#FF2D78' },
      { title: 'Minimized DFA Transition Table', data: minDfa, color: '#3DFF6A' },
    ];

    defs.forEach(({ title, data, color }) => {
      const alpha = data.alphabet || [];
      const rows  = data.table   || [];

      const sec = document.createElement('div');
      sec.className = 'table-section';
      sec.innerHTML = `
        <h3 class="table-title" style="color:${color}">${title}</h3>
        <div class="table-wrap">
          <table class="state-table">
            <thead>
              <tr>
                <th>State</th>
                ${alpha.map(s => `<th>${escapeHTML(s)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => {
                const label = (row.is_start ? '▶ ' : '') + row.state + (row.is_accept ? ' ★' : '');
                const cls   = row.is_accept ? 'final-row' : row.is_start ? 'start-row' : '';
                return `<tr class="${cls}">
                  <td class="state-cell">${escapeHTML(label)}</td>
                  ${alpha.map(s => `<td>${escapeHTML(row[s] || '∅')}</td>`).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.appendChild(sec);
    });
  }

  /* ============================================================
     11. EXPORT FEATURES
     ============================================================ */
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  window.exportDFAJSON = function () {
    if (!dfaData) return showStatus('⚠ Convert first', 'warn');
    downloadBlob(JSON.stringify(dfaData, null, 2), 'dfa.json', 'application/json');
    showStatus('DFA JSON exported', 'ok');
  };

  window.exportMinDFAJSON = function () {
    if (!minDfaData) return showStatus('⚠ Convert first', 'warn');
    downloadBlob(JSON.stringify(minDfaData, null, 2), 'min_dfa.json', 'application/json');
    showStatus('Min-DFA JSON exported', 'ok');
  };

  function exportCyPNG(cy, filename) {
    if (!cy) return showStatus('⚠ Graph not available', 'warn');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg     = isDark ? '#070914' : '#EEF2FC';
    const uri    = cy.png({ bg, scale: 2 });
    const a      = Object.assign(document.createElement('a'), { href: uri, download: filename });
    a.click();
    showStatus(`${filename} exported`, 'ok');
  }

  window.exportNFAPNG = () => exportCyPNG(cyNFA, 'nfa_graph.png');
  window.exportDFAPNG = () => exportCyPNG(cyDFA, 'dfa_graph.png');
  window.exportMinPNG = () => exportCyPNG(cyMin,  'min_dfa_graph.png');

  /* ============================================================
     12. THEME TOGGLE
     ============================================================ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nfa_theme', theme);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';

    setTimeout(() => {
      if (cyNFA) cyNFA.style(getCyStyle('#FFB800', '#FFB800'));
      if (cyDFA) cyDFA.style(getCyStyle('#FF2D78', '#FF2D78'));
      if (cyMin) cyMin.style(getCyStyle('#3DFF6A', '#3DFF6A'));
    }, 50);
  }

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  /* ============================================================
     13. PRESETS
     ============================================================ */
  window.loadPreset = function (name) {
    clearAll(true);
    const p = PRESETS[name];
    if (!p) return;

    for (const [sname, info] of Object.entries(p.states)) {
      statesMap[sname] = { ...info };
    }
    for (const t of p.transitions) {
      transList.push({ ...t });
    }

    updateStateList();
    updateTransList();
    renderNFAGraph();
    showStatus(`Loaded: ${p.label}`, 'ok');
  };

  /* ============================================================
     14. UTILITY
     ============================================================ */
  window.clearAll = function (silent) {
    Object.keys(statesMap).forEach(k => delete statesMap[k]);
    transList.length = 0;
    dfaData = minDfaData = nfaData = null;

    updateStateList();
    updateTransList();
    renderNFAGraph();

    if (cyDFA) { cyDFA.destroy(); cyDFA = null; }
    if (cyMin) { cyMin.destroy(); cyMin = null; }

    const ph = '<div class="placeholder"><div class="ph-icon">⬡</div><p>Awaiting conversion…</p></div>';
    document.getElementById('cy-dfa').innerHTML = ph;
    document.getElementById('cy-min').innerHTML = ph;

    document.getElementById('stepsContent').innerHTML =
      '<div class="empty-state"><span class="empty-icon">≡</span><p>Run conversion to see steps.</p></div>';
    document.getElementById('tablesContent').innerHTML =
      '<div class="empty-state"><span class="empty-icon">⊞</span><p>Run conversion to view tables.</p></div>';
    document.getElementById('simResult').innerHTML = '';

    document.querySelectorAll('.graph-badge').forEach(b => (b.style.display = 'none'));

    if (!silent) showStatus('Cleared', 'info');
  };

  window.layoutGraphs = function () {
    const cfg = coselayout(true);
    [cyNFA, cyDFA, cyMin].forEach(cy => { if (cy) cy.layout(cfg).run(); });
  };

  window.switchTab = function (name) {
    document.querySelectorAll('.tab-btn').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === name)
    );
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + name);
    if (panel) panel.classList.add('active');

    setTimeout(() => {
      if (name === 'graphs') {
        [cyNFA, cyDFA, cyMin].forEach(cy => { if (cy) { cy.resize(); fitGraph(cy); } });
      }
    }, 50);
  };

  /* Status toast helper */
  let toastTimer;
  window.showStatus = function (msg, type = 'info') {
    const el = document.getElementById('statusToast');
    el.textContent = msg;
    el.className = `status-toast show type-${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
  };

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============================================================
     15. BOOTSTRAP
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('nfa_theme') || 'dark';
    applyTheme(savedTheme);

    initCy();
    loadPreset('ends_ab');

    document.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (document.activeElement.id === 'stateName')  window.addState();
        if (document.activeElement.id === 'transTo')    window.addTransition();
        if (document.activeElement.id === 'simInput')   window.runSimulate();
      }
    });

    window.addEventListener('resize', () => {
      [cyNFA, cyDFA, cyMin].forEach(cy => { if (cy) cy.resize(); });
    });
  });

})();
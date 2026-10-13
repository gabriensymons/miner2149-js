/**
 * Development-only panel: one box, a tab per playable disaster, and a footer
 * for the tools that apply whichever tab is open.
 *
 * Never reaches production; see meteor-trigger.js. Each trigger module adds its
 * own tab with `addTab`, so a new playable disaster brings its knobs with it.
 */

export const PANEL_ID = 'miner-dev-panel';

const STYLE = `
#${PANEL_ID} {
  position: fixed; left: 12px; bottom: 12px; z-index: 9999;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #12161f; color: #d7dee9; border: 1px solid #38455c;
  border-radius: 6px; padding: 10px 12px; min-width: 190px;
  box-shadow: 0 6px 20px rgba(0,0,0,.45);
}
#${PANEL_ID} h2 {
  margin: 0 0 8px; font-size: 11px; letter-spacing: .09em;
  text-transform: uppercase; color: #8fa3c0; font-weight: 600;
}
#${PANEL_ID} button {
  display: block; width: 100%; margin-top: 6px; padding: 6px 8px;
  font: inherit; color: #f2f6fb; background: #24304a;
  border: 1px solid #3d4d6b; border-radius: 4px; cursor: pointer;
}
#${PANEL_ID} button:hover:not(:disabled) { background: #2f3e5e; }
#${PANEL_ID} button:disabled { opacity: .45; cursor: not-allowed; }
#${PANEL_ID} label { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
#${PANEL_ID} input, #${PANEL_ID} select { width: 58px; font: inherit; padding: 2px 4px;
  background: #0d1119; color: #d7dee9; border: 1px solid #38455c; border-radius: 3px; }
#${PANEL_ID} .derived { margin: 6px 0 0; color: #7f8ea6; font-size: 11px; }
#${PANEL_ID} .status { margin-top: 8px; color: #7f8ea6; min-height: 1.4em; }
#${PANEL_ID} .flag { color: #e0a340; font-weight: 600; }
#${PANEL_ID} [role="tablist"] { display: flex; gap: 4px; margin-bottom: 8px; }
#${PANEL_ID} [role="tab"] { width: auto; flex: 1; margin-top: 0; padding: 4px 6px;
  font-size: 11px; background: #0d1119; color: #8fa3c0; }
#${PANEL_ID} [role="tab"][aria-selected="true"] { background: #2f3e5e; color: #f2f6fb; }
#${PANEL_ID} .footer { margin-top: 12px; padding-top: 4px; border-top: 1px solid #2a3447; }
`;

const panels = new WeakMap();

/**
 * The panel in `documentRef`, mounted on first use. Returns `{ panel, footer,
 * addTab(id, label) }`; `addTab` returns the tab's body to fill. The first tab
 * added is the one shown.
 */
export function devPanel(documentRef = globalThis.document) {
  if (!documentRef) return null;
  if (panels.has(documentRef)) return panels.get(documentRef);

  const style = documentRef.createElement('style');
  style.textContent = STYLE;
  documentRef.head.appendChild(style);

  const panel = documentRef.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div role="tablist" aria-label="Development tools"></div>
    <div class="tabs"></div>
    <div class="footer"></div>
  `;
  documentRef.body.appendChild(panel);
  const tablist = panel.querySelector('[role="tablist"]');
  const bodies = panel.querySelector('.tabs');
  const footer = panel.querySelector('.footer');
  const tabs = [];

  function select(id) {
    for (const tab of tabs) {
      const selected = tab.id === id;
      tab.button.setAttribute('aria-selected', String(selected));
      tab.body.hidden = !selected;
    }
  }

  function addTab(id, label) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.id = `${PANEL_ID}-tab-${id}`;
    button.textContent = label;
    const body = documentRef.createElement('section');
    body.setAttribute('role', 'tabpanel');
    body.setAttribute('aria-labelledby', button.id);
    tablist.appendChild(button);
    bodies.appendChild(body);
    tabs.push({ id, button, body });
    button.addEventListener('click', () => select(id));
    select(tabs[0].id);
    return body;
  }

  const handle = { panel, footer, addTab };
  panels.set(documentRef, handle);
  return handle;
}

// A tiny element builder. Text goes in as text nodes, never as HTML, so nothing a person types
// (a project's description, a team's note) can inject markup.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let deferredValue;
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'value') {
      if (tag === 'select') deferredValue = value;
      else el.value = value;
    } else if (key === 'checked' || key === 'disabled' || key === 'required') el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function mount(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

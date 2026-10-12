type Child = Node | string | number | null | undefined | false
type Props = Record<string, unknown>

/** Tiny DOM builder: h('button', { class: 'x', onclick: fn, 'data-id': 1 }, 'label') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener)
    else if (k === 'class') el.className = String(v)
    else if (k === 'text') el.textContent = String(v)
    else if (k === 'style') el.setAttribute('style', String(v))
    else if (k in el && !k.startsWith('data-') && !k.startsWith('aria-')) (el as any)[k] = v
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const c of children)
    if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c))
  return el
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove()
}

/** A labelled range input that does not jump while it is being dragged. */
export function slider(
  label: string,
  opts: {
    min?: number
    max?: number
    step?: number
    get: () => number
    set: (v: number) => void
    attrs?: Props
  },
): { el: HTMLElement; sync(): void } {
  const out = h('span', { class: 'val' })
  const input = h('input', {
    type: 'range',
    min: opts.min ?? 0,
    max: opts.max ?? 1,
    step: opts.step ?? 0.001,
    oninput: () => opts.set(Number(input.value)),
    ...opts.attrs,
  })
  const fmt = (v: number) => ((opts.max ?? 1) > 1 ? v.toFixed(1) : v.toFixed(2))
  const sync = () => {
    const v = opts.get()
    if (document.activeElement !== input) input.value = String(v)
    out.textContent = fmt(v)
  }
  sync()
  return { el: h('label', { class: 'slider' }, h('span', { class: 'name' }, label), input, out), sync }
}

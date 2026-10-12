import { distanceFor, heightFor, imageWidth } from '../../core/throwcalc'
import { h } from '../h'

/** Projector planning: how big an image a projector throws from a distance, and the reverse. */
export function toolsPanel(): HTMLElement {
  const ratio = h('input', { type: 'number', step: 0.01, min: 0.1, value: 1.5 })
  const distance = h('input', { type: 'number', step: 0.1, min: 0, value: 6 })
  const width = h('input', { type: 'number', step: 0.1, min: 0, value: 4 })
  const aspect = h(
    'select',
    {},
    ...[
      ['16:9', 16 / 9],
      ['16:10', 16 / 10],
      ['4:3', 4 / 3],
    ].map(([l, v]) => h('option', { value: String(v), text: String(l) })),
  )
  const out1 = h('p', { class: 'status' })
  const out2 = h('p', { class: 'status' })
  const m = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)} m` : '—')
  const update = () => {
    const r = Number(ratio.value)
    const a = Number(aspect.value)
    const w = imageWidth(Number(distance.value), r)
    out1.textContent = `from ${distance.value} m: image ${m(w)} wide × ${m(heightFor(w, a))} high`
    out2.textContent = `a ${width.value} m wide image needs the projector ${m(distanceFor(Number(width.value), r))} away`
  }
  for (const i of [ratio, distance, width, aspect]) i.addEventListener('input', update)
  update()
  const field = (label: string, input: HTMLElement) =>
    h('label', { class: 'field inline' }, h('span', { class: 'name', text: label }), input)
  return h(
    'div',
    { class: 'panel tools' },
    h('h3', { text: 'throw distance' }),
    h('p', { class: 'status', text: 'Throw ratio is on the projector spec sheet (distance ÷ image width).' }),
    h('div', { class: 'row' }, field('throw ratio', ratio), field('aspect', aspect)),
    h('div', { class: 'row' }, field('distance m', distance)),
    out1,
    h('div', { class: 'row' }, field('image width m', width)),
    out2,
  )
}

import { PROFILE_CHANNELS, validatePatch } from '../../core/fixtures'
import type { Fixture, PatternKind, Profile } from '../../core/types'
import { clear, h } from '../h'
import type { Lights } from '../lights'
import type { Store } from '../store'

const PROFILES: Profile[] = ['rgb', 'rgbw', 'dimmer', 'mover']
const MODES: Fixture['mode'][] = ['pixel', 'beat', 'static']
const KINDS: PatternKind[] = ['circle', 'figure8', 'sweep', 'fan']

const nextAddress = (fs: Fixture[], universe: number) =>
  fs
    .filter((f) => f.universe === universe)
    .reduce((a, f) => Math.max(a, f.address + PROFILE_CHANNELS[f.profile].length), 1)

function addFixtures(store: Store, profile: Profile, count: number, group: string) {
  store.set((s) => {
    const fs = [...s.fixtures]
    let addr = nextAddress(fs, 0)
    for (let i = 0; i < count; i++) {
      let n = fs.length + 1
      while (fs.some((f) => f.id === `f${n}`)) n++
      const f: Fixture = {
        id: `f${n}`,
        name: `${profile} ${i + 1}`,
        profile,
        universe: 0,
        address: addr,
        x: count > 1 ? 0.1 + (0.8 * i) / (count - 1) : 0.5,
        y: profile === 'mover' ? 0.15 : 0.85,
        group,
        mode: profile === 'mover' ? 'beat' : 'pixel',
        color: [1, 1, 1],
        pattern:
          profile === 'mover' ? { kind: 'circle', size: 0.35, centre: [0.5, 0.6], speed: 1 } : undefined,
      }
      addr += PROFILE_CHANNELS[profile].length
      fs.push(f)
    }
    return { ...s, fixtures: fs }
  })
}

/** Patch, modes, mover patterns, a plan-view visualiser and a DMX monitor. */
export function lightsPanel(store: Store, lights: Lights): { el: HTMLElement; frame(): void } {
  const status = h('p', { class: 'status' })
  const errors = h('div', { class: 'status err' })
  const table = h('table', { class: 'patch' })
  const vis = h('canvas', { class: 'vis', width: 640, height: 360 })
  const monitor = h('canvas', { class: 'monitor', width: 512, height: 128 })
  const universeSel = h('input', { type: 'number', min: 0, max: 32767, value: 0 })

  const up = (id: string, patch: Partial<Fixture>) =>
    store.set((s) => ({ ...s, fixtures: s.fixtures.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))

  function renderTable() {
    const fs = store.get().fixtures
    clear(table)
    table.append(
      h(
        'tr',
        {},
        ...['name', 'type', 'universe', 'address', 'group', 'follows', 'pattern', 'x', 'y', ''].map((t) =>
          h('th', { text: t }),
        ),
      ),
    )
    for (const f of fs) {
      const num = (key: 'universe' | 'address' | 'x' | 'y', step: number, min: number, max: number) => {
        const i = h('input', {
          type: 'number',
          step,
          min,
          max,
          value: f[key],
          onchange: () => up(f.id, { [key]: Math.min(max, Math.max(min, Number(i.value))) }),
        })
        return h('td', {}, i)
      }
      const select = <T extends string>(opts: readonly T[], value: T, on: (v: T) => void) => {
        const s = h(
          'select',
          { onchange: () => on(s.value as T) },
          ...opts.map((o) => h('option', { value: o, text: o })),
        )
        s.value = value
        return s
      }
      const name = h('input', { type: 'text', value: f.name, onchange: () => up(f.id, { name: name.value }) })
      const group = h('input', {
        type: 'text',
        value: f.group,
        onchange: () => up(f.id, { group: group.value || 'all' }),
      })
      table.append(
        h(
          'tr',
          {},
          h('td', {}, name),
          h(
            'td',
            {},
            select(PROFILES, f.profile, (v) => up(f.id, { profile: v })),
          ),
          num('universe', 1, 0, 32767),
          num('address', 1, 1, 512),
          h('td', {}, group),
          h(
            'td',
            {},
            select(MODES, f.mode, (v) => up(f.id, { mode: v })),
          ),
          h(
            'td',
            {},
            f.profile === 'mover'
              ? select(KINDS, f.pattern?.kind ?? 'circle', (v) =>
                  up(f.id, { pattern: { size: 0.35, centre: [0.5, 0.6], speed: 1, ...f.pattern, kind: v } }),
                )
              : '',
          ),
          num('x', 0.05, 0, 1),
          num('y', 0.05, 0, 1),
          h(
            'td',
            {},
            h('button', {
              text: '×',
              title: 'remove',
              onclick: () => store.set((s) => ({ ...s, fixtures: s.fixtures.filter((x) => x.id !== f.id) })),
            }),
          ),
        ),
      )
    }
    const errs = validatePatch(fs)
    errors.textContent = errs.join(' · ')
  }

  function drawVis() {
    const g = vis.getContext('2d')!
    const W = vis.width
    const H = vis.height
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = '#2a2a2d'
    g.strokeRect(0.5, 0.5, W - 1, H - 1)
    for (const f of store.get().fixtures) {
      const v = lights.values(f.id)
      if (!v) continue
      const x = f.x * W
      const y = f.y * H
      if (f.profile === 'mover') {
        const k = (v.dimmer ?? 0) / 255
        const pan = ((v.pan ?? 0) * 256 + (v.panFine ?? 0)) / 65535
        const tilt = ((v.tilt ?? 0) * 256 + (v.tiltFine ?? 0)) / 65535
        const tx = pan * W
        const ty = tilt * H
        const grad = g.createLinearGradient(x, y, tx, ty)
        grad.addColorStop(0, `rgba(${v.r},${v.g},${v.b},${0.7 * k})`)
        grad.addColorStop(1, `rgba(${v.r},${v.g},${v.b},0)`)
        g.strokeStyle = grad
        g.lineWidth = 10
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(tx, ty)
        g.stroke()
        g.fillStyle = '#e6e4e0'
        g.fillRect(x - 5, y - 5, 10, 10)
      } else {
        const rgb =
          f.profile === 'dimmer'
            ? [v.dimmer, v.dimmer, v.dimmer]
            : [
                Math.min(255, v.r + (v.w ?? 0)),
                Math.min(255, v.g + (v.w ?? 0)),
                Math.min(255, v.b + (v.w ?? 0)),
              ]
        g.fillStyle = `rgb(${rgb.join(',')})`
        g.beginPath()
        g.arc(x, y, 12, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#555'
        g.stroke()
      }
    }
  }

  function drawMonitor() {
    const g = monitor.getContext('2d')!
    const u = lights.universes().get(Number(universeSel.value)) ?? new Uint8Array(512)
    const cw = monitor.width / 32
    const ch = monitor.height / 16
    for (let i = 0; i < 512; i++) {
      const v = u[i]
      g.fillStyle = `rgb(${v},${Math.round(v * 0.7)},${Math.round(v * 0.13)})`
      g.fillRect((i % 32) * cw, Math.floor(i / 32) * ch, cw - 1, ch - 1)
    }
  }

  store.on(() => {
    if (!table.contains(document.activeElement)) renderTable()
  })
  renderTable()

  const el = h(
    'div',
    { class: 'panel lights' },
    status,
    h(
      'div',
      { class: 'row' },
      h('button', { text: '+ 4 RGB pars', onclick: () => addFixtures(store, 'rgb', 4, 'pars') }),
      h('button', { text: '+ 4 moving heads', onclick: () => addFixtures(store, 'mover', 4, 'movers') }),
      h('button', { text: '+ RGBW wash', onclick: () => addFixtures(store, 'rgbw', 1, 'wash') }),
      h('button', { text: '+ dimmer', onclick: () => addFixtures(store, 'dimmer', 1, 'dimmers') }),
    ),
    h(
      'p',
      { class: 'status' },
      'pixel = colour of the picture at x, y · beat = chase through the group on the beat · moving heads follow their pattern in time with the BPM',
    ),
    h('div', { class: 'scroll' }, table),
    errors,
    h('h3', { text: 'visualiser' }),
    vis,
    h('h3', { text: 'DMX' }),
    h('label', { class: 'field inline' }, h('span', { class: 'name', text: 'universe' }), universeSel),
    monitor,
  )

  return {
    el,
    frame() {
      const st = lights.status()
      const info = lights.info()
      status.textContent =
        st === 'checking'
          ? 'looking for the throw server…'
          : st === 'none'
            ? 'no throw server: lights are simulated here. Run `throw` on this laptop to send Art-Net.'
            : st === 'offline'
              ? 'throw server not answering; retrying'
              : `Art-Net to ${info?.artnet}${info?.nodes.length ? ` · nodes: ${info.nodes.map((n) => `${n.shortName} (${n.ip})`).join(', ')}` : ' · no nodes answered ArtPoll'}`
      status.className = `status${st === 'offline' ? ' err' : ''}`
      drawVis()
      drawMonitor()
    },
  }
}

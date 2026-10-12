import { defaultOutput, defaultSurface } from '../../core/show'
import type { Output, Rect, Show, Surface, Vec2 } from '../../core/types'
import { clear, h, slider } from '../h'
import type { Runtime } from '../runtime'
import type { Store } from '../store'

const NUDGE = 1 / 1920

type Sel = { output: string; surface: string; corner: number }

export function updateSurface(store: Store, out: string, surf: string, fn: (s: Surface) => Surface): void {
  store.set((show) => ({
    ...show,
    outputs: show.outputs.map((o) =>
      o.id !== out
        ? o
        : { ...o, surfaces: o.surfaces.map((s) => (s.id === surf ? fn(structuredClone(s)) : s)) },
    ),
  }))
}

const updateOutput = (store: Store, id: string, fn: (o: Output) => Output) =>
  store.set((show) => ({
    ...show,
    outputs: show.outputs.map((o) => (o.id === id ? fn(structuredClone(o)) : o)),
  }))

const nextId = (prefix: string, taken: string[]) => {
  let n = 1
  while (taken.includes(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

const SLICES: [string, Rect][] = [
  ['full', { x: 0, y: 0, w: 1, h: 1 }],
  ['left ½', { x: 0, y: 0, w: 0.5, h: 1 }],
  ['right ½', { x: 0.5, y: 0, w: 0.5, h: 1 }],
  ['⅓ 1', { x: 0, y: 0, w: 1 / 3, h: 1 }],
  ['⅓ 2', { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }],
  ['⅓ 3', { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }],
  ['top ½', { x: 0, y: 0, w: 1, h: 0.5 }],
  ['bottom ½', { x: 0, y: 0.5, w: 1, h: 0.5 }],
]

type ScreenInfo = { label: string; left: number; top: number; width: number; height: number }

/** Outputs, their surfaces, corner pinning, slices and windows. */
export function mappingPanel(store: Store, rt: Runtime): { el: HTMLElement; frame(): void } {
  let sel: Sel | null = null
  let screens: ScreenInfo[] = []
  const list = h('div', { class: 'outputs' })
  const editor = h('div', { class: 'surface-editor' })
  const schematic = h('canvas', { class: 'schematic', tabIndex: 0, width: 640, height: 360 })
  const screenStatus = h('p', { class: 'status' })

  const find = (show: Show = store.get()) => {
    const o = sel && show.outputs.find((x) => x.id === sel!.output)
    const s = o?.surfaces.find((x) => x.id === sel!.surface)
    return o && s ? { o, s } : null
  }

  async function findScreens() {
    const w = window as any
    if (!w.getScreenDetails) {
      screenStatus.textContent = 'this browser cannot place windows on screens; drag the window and press F'
      return
    }
    try {
      const d = await w.getScreenDetails()
      screens = d.screens.map((s: any, i: number) => ({
        label: `${s.label || `screen ${i + 1}`} ${s.width}×${s.height}${s.isPrimary ? ' (main)' : ''}`,
        left: s.availLeft,
        top: s.availTop,
        width: s.availWidth,
        height: s.availHeight,
      }))
      screenStatus.textContent = `${screens.length} screen${screens.length === 1 ? '' : 's'} found`
      renderList()
    } catch (e) {
      screenStatus.textContent = `screens not available: ${(e as Error).message}`
    }
  }

  function open(o: Output, screen: number) {
    const sc = screens[screen]
    const features = sc
      ? `popup,left=${sc.left},top=${sc.top},width=${sc.width},height=${sc.height}`
      : 'popup,width=960,height=540'
    window.open(`output.html?id=${encodeURIComponent(o.id)}`, `throw-${o.id}`, features)
  }

  function renderList() {
    const show = store.get()
    clear(list)
    for (const o of show.outputs) {
      const name = h('input', {
        type: 'text',
        value: o.name,
        onchange: () => updateOutput(store, o.id, (x) => ({ ...x, name: name.value || x.name })),
      })
      const screen = h(
        'select',
        {},
        h('option', { value: '-1', text: 'this screen' }),
        ...screens.map((s, i) => h('option', { value: String(i), text: s.label })),
      )
      const surfaces = o.surfaces.map((s) =>
        h('button', {
          text: s.id,
          'data-surface': `${o.id}/${s.id}`,
          class: sel?.output === o.id && sel.surface === s.id ? 'on' : '',
          onclick: () => {
            sel = { output: o.id, surface: s.id, corner: 0 }
            renderList()
            renderEditor()
          },
        }),
      )
      list.append(
        h(
          'div',
          { class: 'output' },
          h('div', { class: 'row' }, name),
          h(
            'div',
            { class: 'row' },
            h('button', { text: 'open window', onclick: () => open(o, Number(screen.value)) }),
            screens.length ? screen : null,
            h('button', {
              text: 'test card',
              class: o.testCard ? 'on' : '',
              'data-testcard': o.id,
              onclick: () => updateOutput(store, o.id, (x) => ({ ...x, testCard: !x.testCard })),
            }),
            show.outputs.length > 1
              ? h('button', {
                  text: 'remove',
                  onclick: () => {
                    if (sel?.output === o.id) sel = null
                    store.set((s) => ({ ...s, outputs: s.outputs.filter((x) => x.id !== o.id) }))
                  },
                })
              : null,
          ),
          h(
            'div',
            { class: 'row' },
            h('span', { class: 'name', text: 'surfaces' }),
            ...surfaces,
            h('button', {
              text: '+ surface',
              'data-add-surface': o.id,
              onclick: () => {
                const id = nextId(
                  's',
                  o.surfaces.map((s) => s.id),
                )
                const s = defaultSurface(id)
                s.corners = [
                  [0.25, 0.25],
                  [0.75, 0.25],
                  [0.75, 0.75],
                  [0.25, 0.75],
                ]
                updateOutput(store, o.id, (x) => ({ ...x, surfaces: [...x.surfaces, s] }))
                sel = { output: o.id, surface: id, corner: 0 }
                renderEditor()
              },
            }),
          ),
        ),
      )
    }
  }

  let editorSyncs: (() => void)[] = []
  function renderEditor() {
    clear(editor)
    editorSyncs = []
    const f = find()
    if (!f) {
      editor.append(h('p', { class: 'status', text: 'pick a surface to pin its corners' }))
      return
    }
    const up = (fn: (s: Surface) => Surface) => updateSurface(store, f.o.id, f.s.id, fn)
    const sliders = [
      slider('feather', {
        max: 0.5,
        get: () => find()?.s.feather ?? 0,
        set: (v) => up((s) => ({ ...s, feather: v })),
      }),
      slider('brightness', {
        get: () => find()?.s.brightness ?? 1,
        set: (v) => up((s) => ({ ...s, brightness: v })),
      }),
    ]
    editorSyncs = sliders.map((s) => s.sync)
    const sliceInputs = (['x', 'y', 'w', 'h'] as const).map((k) => {
      const input = h('input', {
        type: 'number',
        step: 0.01,
        min: 0,
        max: 1,
        onchange: () =>
          up((s) => ({ ...s, slice: { ...s.slice, [k]: Math.min(1, Math.max(0, Number(input.value))) } })),
      })
      editorSyncs.push(() => {
        if (document.activeElement !== input) input.value = (find()?.s.slice[k] ?? 0).toFixed(3)
      })
      return h('label', { class: 'field inline' }, h('span', { class: 'name', text: k }), input)
    })
    editor.append(
      h('h3', { text: `${f.o.name} · ${f.s.id}` }),
      h(
        'p',
        { class: 'status' },
        'drag the corners here or on the wall (the output window shows them while this tab is open). Arrows nudge 1 px, Shift 10 px.',
      ),
      schematic,
      h('h3', { text: 'slice of the program' }),
      h(
        'div',
        { class: 'row' },
        ...SLICES.map(([label, r]) =>
          h('button', { text: label, onclick: () => up((s) => ({ ...s, slice: { ...r } })) }),
        ),
      ),
      h('div', { class: 'row' }, ...sliceInputs),
      ...sliders.map((s) => s.el),
      h(
        'div',
        { class: 'row' },
        h('button', {
          text: 'reset corners',
          onclick: () => up((s) => ({ ...s, corners: defaultSurface().corners })),
        }),
        h('button', {
          text: 'remove surface',
          onclick: () => {
            updateOutput(store, f.o.id, (o) => ({
              ...o,
              surfaces: o.surfaces.filter((s) => s.id !== f.s.id),
            }))
            sel = null
            renderEditor()
          },
        }),
      ),
    )
  }

  // ── schematic: drag and nudge corners ───────────────────
  const toUv = (e: PointerEvent): Vec2 => {
    const r = schematic.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  let dragging = false
  schematic.addEventListener('pointerdown', (e) => {
    const f = find()
    if (!f || !sel) return
    const [x, y] = toUv(e)
    const r = schematic.getBoundingClientRect()
    let best = -1
    let bestD = 20
    f.s.corners.forEach(([cx, cy], i) => {
      const d = Math.hypot((cx - x) * r.width, (cy - y) * r.height)
      if (d < bestD) {
        best = i
        bestD = d
      }
    })
    if (best >= 0) {
      sel.corner = best
      dragging = true
      schematic.setPointerCapture(e.pointerId)
    }
  })
  schematic.addEventListener('pointermove', (e) => {
    if (!dragging || !sel) return
    const [x, y] = toUv(e)
    const c = sel.corner
    updateSurface(store, sel.output, sel.surface, (s) => {
      s.corners[c] = [x, y]
      return s
    })
  })
  schematic.addEventListener('pointerup', () => {
    dragging = false
  })
  schematic.addEventListener('keydown', (e) => {
    if (!sel || !e.key.startsWith('Arrow')) return
    e.preventDefault()
    const k = (e.shiftKey ? 10 : 1) * NUDGE
    const [dx, dy] = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[
      e.key
    ] ?? [0, 0]
    const c = sel.corner
    updateSurface(store, sel.output, sel.surface, (s) => {
      s.corners[c] = [s.corners[c][0] + dx, s.corners[c][1] + dy]
      return s
    })
  })

  function drawSchematic() {
    const r = schematic.getBoundingClientRect()
    if (!r.width) return
    const W = Math.round(r.width * devicePixelRatio)
    const H = Math.round(r.height * devicePixelRatio)
    if (schematic.width !== W || schematic.height !== H) {
      schematic.width = W
      schematic.height = H
    }
    const g = schematic.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    const f = find()
    if (!f) return
    for (const s of f.o.surfaces) {
      const on = s.id === f.s.id
      g.strokeStyle = on ? '#ffb020' : '#555'
      g.lineWidth = on ? 2 : 1
      g.beginPath()
      s.corners.forEach(([x, y], i) => {
        if (i) g.lineTo(x * W, y * H)
        else g.moveTo(x * W, y * H)
      })
      g.closePath()
      g.stroke()
      if (on)
        s.corners.forEach(([x, y], i) => {
          g.fillStyle = i === sel?.corner ? '#ffb020' : '#e6e4e0'
          g.fillRect(x * W - 5, y * H - 5, 10, 10)
        })
    }
  }

  store.on(() => {
    renderListSoon()
  })
  let pending = false
  function renderListSoon() {
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      // keep text inputs stable while typing
      if (!list.contains(document.activeElement)) renderList()
      for (const s of editorSyncs) s()
    })
  }

  renderList()
  renderEditor()
  const el = h(
    'div',
    { class: 'panel mapping' },
    h(
      'div',
      { class: 'row' },
      h('button', {
        text: '+ output',
        onclick: () => {
          const id = nextId(
            'o',
            store.get().outputs.map((o) => o.id),
          )
          store.set((s) => ({ ...s, outputs: [...s.outputs, defaultOutput(id, `Output ${id.slice(1)}`)] }))
        },
      }),
      h('button', { text: 'find screens', onclick: findScreens }),
    ),
    screenStatus,
    list,
    editor,
  )

  return {
    el,
    frame() {
      rt.state.edit = sel ? { output: sel.output, surfaces: [sel.surface] } : null
      drawSchematic()
    },
  }
}

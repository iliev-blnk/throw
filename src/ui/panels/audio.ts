import { listInputs } from '../../audio/live'
import { h } from '../h'
import type { Runtime } from '../runtime'

/** Audio source, meters and the beat clock. */
export function audioPanel(rt: Runtime): { el: HTMLElement; frame(): void } {
  const status = h('p', { id: 'audio-status', class: 'status', text: rt.state.audio.status })
  const devices = h('select', {
    onchange: async () => {
      status.textContent = await rt.setAudio({ deviceId: devices.value })
    },
  })
  const refreshDevices = async () => {
    const list = await listInputs()
    devices.replaceChildren(
      ...list.map((d, i) => h('option', { value: d.deviceId, text: d.label || `input ${i + 1}` })),
    )
  }
  const file = h('input', {
    type: 'file',
    accept: 'audio/*',
    onchange: async () => {
      const f = file.files?.[0]
      if (f) status.textContent = await rt.setAudio({ file: f })
    },
  })
  const meters = ['bass', 'mid', 'high', 'level'].map((name) => {
    const bar = h('i')
    return { bar, el: h('div', { class: 'meter' }, h('span', { text: name }), h('b', {}, bar)) }
  })
  const onset = h('span', { class: 'onset', text: 'onset' })

  const bpm = h('input', {
    type: 'number',
    min: 40,
    max: 200,
    step: 0.1,
    onchange: () => rt.setBpm(Number(bpm.value)),
  })
  const auto = h('input', {
    type: 'checkbox',
    checked: rt.state.auto,
    onchange: () => rt.setAuto(auto.checked),
  })

  const el = h(
    'div',
    { class: 'panel audio' },
    h(
      'div',
      { class: 'row' },
      h('button', {
        text: 'mic / line in',
        'data-audio': 'mic',
        onclick: async () => {
          status.textContent = 'asking for the microphone…'
          status.textContent = await rt.setAudio({})
          await refreshDevices()
        },
      }),
      h('button', {
        text: 'no input',
        onclick: async () => {
          status.textContent = await rt.setAudio(null)
        },
      }),
    ),
    h('label', { class: 'field' }, h('span', { class: 'name' }, 'input'), devices),
    h('label', { class: 'field' }, h('span', { class: 'name' }, 'or play a file'), file),
    status,
    h('div', { class: 'meters' }, ...meters.map((m) => m.el), onset),
    h('h3', { text: 'tempo' }),
    h(
      'div',
      { class: 'row' },
      h('label', { class: 'field inline' }, h('span', { class: 'name' }, 'BPM'), bpm),
      h('button', { text: 'tap (space)', onclick: () => rt.tap() }),
      h('button', { text: 'beat 1 (enter)', onclick: () => rt.resync() }),
      h('button', { text: '½', onclick: () => rt.setBpm(rt.state.clock.bpm / 2) }),
      h('button', { text: '×2', onclick: () => rt.setBpm(rt.state.clock.bpm * 2) }),
    ),
    h('label', { class: 'check' }, auto, ' follow the music (auto tempo + phase lock)'),
  )

  return {
    el,
    frame() {
      const f = rt.state.features
      ;[f.bass, f.mid, f.high, f.level].forEach((v, i) => {
        meters[i].bar.style.width = `${Math.round(v * 100)}%`
      })
      onset.classList.toggle('on', f.pulse > 0.5)
      if (document.activeElement !== bpm) bpm.value = rt.state.clock.bpm.toFixed(1)
    },
  }
}

import { defaultShow, MAX_STROBE, parseShow } from '../../core/show'
import { h } from '../h'
import type { Store } from '../store'

const pad = (n: number) => String(n).padStart(2, '0')
const day = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const clock = (d = new Date()) => `${day(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

function download(blob: Blob, name: string) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** mp4 where the browser can encode it, webm everywhere else */
export function recordingType(): { mime: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const mime of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
    if (MediaRecorder.isTypeSupported(mime))
      return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }
  return null
}

/** Show files (export, import, reset), recording the preview, and the safety settings. */
export function showPanel(
  store: Store,
  canvas: HTMLCanvasElement,
  panic: () => void,
): { el: HTMLElement; frame(): void; sync(): void } {
  const status = h('p', { class: 'status', id: 'show-status' })
  const say = (text: string, kind: '' | 'err' = '') => {
    status.textContent = text
    status.className = `status ${kind}`
  }

  const file = h('input', { type: 'file', accept: '.json,application/json', 'data-show': 'import' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    file.value = ''
    if (!f) return
    let json: unknown
    try {
      json = JSON.parse(await f.text())
    } catch {
      return say(`${f.name}: not a JSON file`, 'err')
    }
    const r = parseShow(json)
    if (!r.ok) return say(`${f.name}: ${r.error}. The current show is unchanged.`, 'err')
    store.replace(r.show)
    say(`loaded ${f.name}. Media files are not part of a show file: add them again on the decks.`)
  })

  const exportShow = () => {
    const name = `show-${day()}.json`
    download(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }), name)
    say(`saved ${name}`)
  }
  const reset = () => {
    if (!confirm('Start from an empty show? Export first if you want to keep this one.')) return
    store.replace(defaultShow())
    say('reset to an empty show')
  }

  // ── recording ──
  const type = recordingType()
  const recStatus = h('p', { class: 'status' })
  const rec = h('button', { 'data-show': 'record', text: 'record preview' })
  let recorder: MediaRecorder | null = null
  let started = 0
  rec.disabled = !type
  recStatus.textContent = type
    ? `Records what the preview shows (program or previs) at 30 fps as ${type.ext}, no sound.`
    : 'This browser cannot record a canvas.'
  rec.addEventListener('click', () => {
    if (recorder) return recorder.stop()
    if (!type) return
    const chunks: Blob[] = []
    const r = new MediaRecorder(canvas.captureStream(30), {
      mimeType: type.mime,
      videoBitsPerSecond: 12_000_000,
    })
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    r.onstop = () => {
      download(new Blob(chunks, { type: type.mime }), `throw-${clock(new Date(started))}.${type.ext}`)
      recorder = null
      rec.classList.remove('on')
      rec.textContent = 'record preview'
    }
    r.start(1000)
    recorder = r
    started = Date.now()
    rec.classList.add('on')
  })

  // ── safety ──
  const cap = h('input', { type: 'number', min: 0, max: MAX_STROBE, step: 0.5, 'data-setting': 'strobeCap' })
  cap.addEventListener('change', () => {
    const v = Math.min(MAX_STROBE, Math.max(0, Number(cap.value) || 0))
    store.set((s) => ({ ...s, settings: { ...s.settings, strobeCap: v } }))
    cap.value = String(v)
  })
  const sync = () => {
    if (document.activeElement !== cap) cap.value = String(store.get().settings.strobeCap)
  }
  sync()

  const el = h(
    'div',
    { class: 'panel show' },
    h('h3', { text: 'show file' }),
    h(
      'div',
      { class: 'row' },
      h('button', { text: 'export', 'data-show': 'export', onclick: exportShow }),
      h('label', { class: 'field inline' }, h('span', { class: 'name', text: 'import' }), file),
      h('button', { text: 'reset', 'data-show': 'reset', onclick: reset }),
    ),
    status,
    h(
      'p',
      { class: 'status' },
      'The show also saves itself in this browser. Export before moving to another laptop.',
    ),
    h('h3', { text: 'record' }),
    h('div', { class: 'row' }, rec),
    recStatus,
    h('h3', { text: 'safety' }),
    h(
      'label',
      { class: 'field inline' },
      h('span', { class: 'name', text: 'strobe cap Hz' }),
      cap,
      h('span', { class: 'name', text: `max ${MAX_STROBE}` }),
    ),
    h(
      'p',
      { class: 'status' },
      'Flashing faster than 3 Hz can trigger seizures in people with photosensitive epilepsy. Keep the cap low unless the venue posts a strobe warning.',
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'blackout on', text: 'panic (Esc)', 'data-show': 'panic', onclick: panic }),
    ),
    h(
      'p',
      { class: 'status' },
      'Panic blacks out the video and sends zeros on every DMX channel, moving heads included, until blackout is lifted (B).',
    ),
  )

  return {
    el,
    sync,
    frame() {
      if (!recorder) return
      const s = Math.floor((Date.now() - started) / 1000)
      rec.textContent = `stop and save ${Math.floor(s / 60)}:${pad(s % 60)}`
    },
  }
}

import { defaultParams, SCENES, sceneById } from '../../scenes/index'
import { clear, h, slider } from '../h'
import type { Store } from '../store'

export type MediaControl = {
  setMedia(deck: 0 | 1, file: File | null): Promise<void>
  setLogo(file: File | null): Promise<void>
}

/** Two decks: scene buttons, the scene's parameters, and scene-specific inputs. */
export function decksPanel(store: Store, media: MediaControl): { el: HTMLElement; sync(): void } {
  const syncs: (() => void)[] = []
  const columns = ([0, 1] as const).map((deck) => {
    const buttons = SCENES.map((s) =>
      h('button', {
        class: 'scene',
        text: s.name,
        'data-deck': deck,
        'data-scene': s.id,
        onclick: () =>
          store.set((show) => {
            const decks = [...show.decks] as typeof show.decks
            decks[deck] = { scene: s.id, params: defaultParams(s.id) }
            return { ...show, decks }
          }),
      }),
    )
    const params = h('div', { class: 'params' })
    const extras = h('div', { class: 'extras' })
    let built = ''
    let paramSyncs: (() => void)[] = []

    const build = (sceneId: string) => {
      built = sceneId
      clear(params)
      clear(extras)
      paramSyncs = sceneById(sceneId).params.map((p, i) => {
        const s = slider(p.name, {
          get: () => store.get().decks[deck].params[i],
          set: (v) =>
            store.set((show) => {
              const decks = structuredClone(show.decks)
              decks[deck].params[i] = v
              return { ...show, decks }
            }),
          attrs: { 'data-param': `${deck}-${i}` },
        })
        params.append(s.el)
        return s.sync
      })
      const def = sceneById(sceneId)
      if (def.tex0 === 'occluder') {
        const text = h('input', {
          type: 'text',
          maxLength: 40,
          value: store.get().settings.text,
          oninput: () => store.set((s) => ({ ...s, settings: { ...s.settings, text: text.value } })),
        })
        const logo = h('input', {
          type: 'file',
          accept: 'image/*',
          onchange: () => void media.setLogo(logo.files?.[0] ?? null),
        })
        extras.append(
          h('label', { class: 'field' }, h('span', { class: 'name' }, 'word'), text),
          h('label', { class: 'field' }, h('span', { class: 'name' }, 'logo png'), logo),
          h('button', { text: 'no logo', onclick: () => void media.setLogo(null) }),
        )
      } else if (def.tex0 === 'word') {
        const words = h('textarea', {
          rows: 3,
          value: store.get().settings.words.join('\n'),
          oninput: () =>
            store.set((s) => ({
              ...s,
              settings: {
                ...s.settings,
                words: words.value
                  .split(/[\n,]/)
                  .map((w) => w.trim())
                  .filter(Boolean),
              },
            })),
        })
        extras.append(
          h('label', { class: 'field' }, h('span', { class: 'name' }, 'words, one per beat'), words),
        )
      } else if (def.tex0 === 'media') {
        const file = h('input', {
          type: 'file',
          accept: 'video/*,image/*',
          onchange: () => void media.setMedia(deck, file.files?.[0] ?? null),
        })
        extras.append(h('label', { class: 'field' }, h('span', { class: 'name' }, 'video or image'), file))
      }
    }

    syncs.push(() => {
      const d = store.get().decks[deck]
      if (d.scene !== built) build(d.scene)
      for (const b of buttons) b.classList.toggle('on', b.dataset.scene === d.scene)
      for (const s of paramSyncs) s()
    })
    return h(
      'section',
      { class: 'deck' },
      h('h2', { text: deck ? 'deck B' : 'deck A' }),
      h('div', { class: 'scenes' }, ...buttons),
      params,
      extras,
    )
  })
  const sync = () => {
    for (const s of syncs) s()
  }
  sync()
  return { el: h('div', { class: 'decks' }, ...columns), sync }
}

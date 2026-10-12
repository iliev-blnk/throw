import { parseShow } from '../core/show'
import type { Show } from '../core/types'

export type Store = {
  get(): Show
  set(fn: (s: Show) => Show): void
  replace(s: Show): void
  on(cb: (s: Show) => void): () => void
}

const KEY = 'throw.show'

export function loadSaved(): Show | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const r = parseShow(JSON.parse(raw))
    return r.ok ? r.show : null
  } catch {
    return null
  }
}

export function createStore(initial: Show, persist = true): Store {
  let show = initial
  const subs = new Set<(s: Show) => void>()
  let timer = 0
  const save = () => {
    if (!persist) return
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(show))
      } catch {
        // storage full or blocked: the show still lives in memory and can be exported
      }
    }, 300)
  }
  const emit = () => {
    for (const s of subs) s(show)
    save()
  }
  return {
    get: () => show,
    set(fn) {
      show = fn(show)
      emit()
    },
    replace(s) {
      show = s
      emit()
    },
    on(cb) {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}

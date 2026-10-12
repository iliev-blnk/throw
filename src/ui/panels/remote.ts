import type { Host } from 'pagepad/host'
import { h } from '../h'

export function remotePanel(get: () => Host | null | undefined): { el: HTMLElement; frame(): void } {
  const status = h('p', { class: 'status' })
  const link = h('input', { type: 'text', readOnly: true })
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  const el = h(
    'div',
    { class: 'panel remote' },
    status,
    local
      ? h(
          'p',
          { class: 'status warn' },
          'This page is open at localhost, which a phone cannot reach. Open the network address that `throw` printed (http://192.168.…:7700) and pair from there.',
        )
      : null,
    h(
      'div',
      { class: 'row' },
      h('button', { text: 'show QR code', onclick: () => get()?.showQR() }),
      h('button', { text: 'hide QR code', onclick: () => get()?.hideQR() }),
    ),
    h('label', { class: 'field' }, h('span', { class: 'name', text: 'pair link' }), link),
    h(
      'p',
      { class: 'status' },
      'Anyone with the code controls the show until you reload this page. Hide the code once your phone is paired.',
    ),
  )
  return {
    el,
    frame() {
      const host = get()
      status.textContent =
        host === undefined
          ? 'starting the remote…'
          : host === null
            ? 'The phone remote needs the throw server. Run `throw` on this laptop.'
            : 'Scan the code with a phone on the same network.'
      if (host && link.value !== host.pairUrl) link.value = host.pairUrl
    },
  }
}

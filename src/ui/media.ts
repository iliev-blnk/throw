// Turn a media blob into an element the engine can sample. Shared by the operator and outputs.

export async function mediaElement(
  blob: Blob,
  kind: 'video' | 'image',
): Promise<HTMLVideoElement | HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  if (kind === 'image') {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  }
  const v = document.createElement('video')
  v.src = url
  v.muted = true
  v.loop = true
  v.playsInline = true
  await new Promise<void>((ok, fail) => {
    v.onloadeddata = () => ok()
    v.onerror = () => fail(new Error('could not load the video'))
  })
  await v.play().catch(() => undefined)
  return v
}

export async function imageElement(blob: Blob): Promise<HTMLImageElement> {
  return (await mediaElement(blob, 'image')) as HTMLImageElement
}

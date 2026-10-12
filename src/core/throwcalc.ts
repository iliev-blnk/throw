// Projector planning. Throw ratio = distance / image width.

export const imageWidth = (distance: number, throwRatio: number): number =>
  throwRatio > 0 ? distance / throwRatio : Number.NaN

export const distanceFor = (width: number, throwRatio: number): number =>
  throwRatio > 0 ? width * throwRatio : Number.NaN

export const heightFor = (width: number, aspect: number): number => (aspect > 0 ? width / aspect : Number.NaN)

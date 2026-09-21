/** 1 second = 24 frames (K / コマ) */
export const FPS = 24
export const MAX_SECONDS = 9999
export const MAX_FRAMES = FPS - 1
export const MAX_TOTAL_FRAMES = MAX_SECONDS * FPS + MAX_FRAMES

export type TimeParts = {
  negative: boolean
  seconds: number
  frames: number
}

export function clampTotalFrames(total: number): number {
  return Math.max(-MAX_TOTAL_FRAMES, Math.min(MAX_TOTAL_FRAMES, total))
}

export function toTotalFrames(seconds: number, frames: number): number {
  return seconds * FPS + frames
}

export function fromTotalFrames(total: number): TimeParts {
  const negative = total < 0
  const abs = Math.abs(total)
  const seconds = Math.floor(abs / FPS)
  const frames = abs % FPS
  return { negative, seconds, frames }
}

/** Normalize a raw frame count (may exceed 23) into seconds + frames. */
export function normalizeFrames(rawFrames: number): TimeParts {
  return fromTotalFrames(clampTotalFrames(rawFrames))
}

export function formatMain(parts: TimeParts): {
  sign: string
  seconds: string
  frames: string
} {
  return {
    sign: parts.negative ? '-' : '',
    seconds: String(parts.seconds),
    frames: String(parts.frames).padStart(2, '0'),
  }
}

export function formatSub(parts: TimeParts): string {
  const sign = parts.negative ? '-' : ''
  return `${sign}${parts.seconds}+${parts.frames}`
}

export const ZERO_PARTS: TimeParts = {
  negative: false,
  seconds: 0,
  frames: 0,
}

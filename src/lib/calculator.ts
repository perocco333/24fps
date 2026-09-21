import {
  FPS,
  MAX_SECONDS,
  MAX_TOTAL_FRAMES,
  ZERO_PARTS,
  clampTotalFrames,
  fromTotalFrames,
  normalizeFrames,
  toTotalFrames,
  type TimeParts,
} from './time'

export type Op = '+' | '-'

/**
 * Entry builder:
 * - Digits default to frames (K).
 * - S commits current digit buffer as seconds, then further digits are frames.
 * - K commits current buffer as frames (explicit).
 */
export type EntryState = {
  /** Digits typed before S / K (interpreted as frames until S). */
  buffer: string
  /** Set when S was pressed. */
  seconds: number | null
  /** Digits for the frame part after S. */
  frameBuffer: string
  /** True after K, shortcut, or equals. */
  locked: boolean
  lockedParts: TimeParts | null
}

export type CalcState = {
  entry: EntryState
  /** Running total in frames (can be negative). */
  accumulator: number
  /** Whether sub-display should show. */
  showSub: boolean
  /** After '=', next digit starts a fresh calculation. */
  justEvaluated: boolean
}

export function emptyEntry(): EntryState {
  return {
    buffer: '',
    seconds: null,
    frameBuffer: '',
    locked: false,
    lockedParts: null,
  }
}

export function initialState(): CalcState {
  return {
    entry: emptyEntry(),
    accumulator: 0,
    showSub: false,
    justEvaluated: false,
  }
}

export function entryToParts(entry: EntryState): TimeParts {
  if (entry.locked && entry.lockedParts) {
    return entry.lockedParts
  }

  if (entry.seconds !== null) {
    const frames =
      entry.frameBuffer === '' ? 0 : parseInt(entry.frameBuffer, 10)
    const cappedFrames = Math.min(
      FPS - 1,
      Math.max(0, Number.isNaN(frames) ? 0 : frames),
    )
    const seconds = Math.min(MAX_SECONDS, Math.max(0, entry.seconds))
    return { negative: false, seconds, frames: cappedFrames }
  }

  if (entry.buffer === '') {
    return ZERO_PARTS
  }

  const raw = parseInt(entry.buffer, 10)
  if (Number.isNaN(raw)) return ZERO_PARTS
  return normalizeFrames(Math.min(MAX_TOTAL_FRAMES, raw))
}

export function entryToTotalFrames(entry: EntryState): number {
  const p = entryToParts(entry)
  const sign = p.negative ? -1 : 1
  return sign * toTotalFrames(p.seconds, p.frames)
}

export function hasEntryInput(entry: EntryState): boolean {
  if (entry.locked && entry.lockedParts) {
    const p = entry.lockedParts
    return p.seconds !== 0 || p.frames !== 0 || p.negative
  }
  if (entry.seconds !== null) return true
  return entry.buffer !== ''
}

function lockParts(parts: TimeParts): EntryState {
  return {
    buffer: '',
    seconds: null,
    frameBuffer: '',
    locked: true,
    lockedParts: { ...parts },
  }
}

/** After '=', a digit / unit / shortcut starts a brand-new calculation. */
function prepareForNewEntry(state: CalcState): CalcState {
  if (!state.justEvaluated) return state
  return {
    ...state,
    entry: emptyEntry(),
    accumulator: 0,
    showSub: false,
    justEvaluated: false,
  }
}

export function pressDigit(state: CalcState, digit: string): CalcState {
  let s = prepareForNewEntry(state)

  if (s.entry.locked) {
    s = { ...s, entry: emptyEntry() }
  }

  const entry = { ...s.entry }

  if (entry.seconds !== null) {
    if (entry.frameBuffer.length >= 2) return s
    const candidate = entry.frameBuffer + digit
    if (parseInt(candidate, 10) > FPS - 1) return s
    entry.frameBuffer = candidate
    return { ...s, entry }
  }

  if (entry.buffer.length >= 6) return s
  const next = (entry.buffer === '0' ? '' : entry.buffer) + digit
  const raw = parseInt(next, 10)
  if (Number.isNaN(raw) || raw > MAX_TOTAL_FRAMES) return s
  entry.buffer = next
  return { ...s, entry }
}

export function pressS(state: CalcState): CalcState {
  let s = prepareForNewEntry(state)

  if (s.entry.locked && s.entry.lockedParts) {
    const parts = s.entry.lockedParts
    // Treat pure-frame values as the seconds buffer (e.g. 12K → S → 12秒).
    const secValue =
      parts.seconds === 0 ? parts.frames : parts.seconds
    return {
      ...s,
      entry: {
        buffer: '',
        seconds: Math.min(MAX_SECONDS, Math.abs(secValue)),
        frameBuffer: '',
        locked: false,
        lockedParts: null,
      },
    }
  }

  if (s.entry.seconds !== null) return s

  const sec = s.entry.buffer === '' ? 0 : parseInt(s.entry.buffer, 10)
  if (Number.isNaN(sec)) return s

  return {
    ...s,
    entry: {
      buffer: '',
      seconds: Math.min(MAX_SECONDS, sec),
      frameBuffer: '',
      locked: false,
      lockedParts: null,
    },
  }
}

export function pressK(state: CalcState): CalcState {
  const s = prepareForNewEntry(state)
  if (s.entry.locked) return s

  if (s.entry.seconds !== null) {
    return { ...s, entry: lockParts(entryToParts(s.entry)) }
  }

  if (s.entry.buffer === '') {
    return { ...s, entry: lockParts(ZERO_PARTS) }
  }

  const raw = parseInt(s.entry.buffer, 10)
  if (Number.isNaN(raw)) return s
  return {
    ...s,
    entry: lockParts(normalizeFrames(Math.min(MAX_TOTAL_FRAMES, raw))),
  }
}

export function pressShortcut(
  state: CalcState,
  frames: 6 | 12 | 18,
): CalcState {
  const s = prepareForNewEntry(state)
  return { ...s, entry: lockParts(normalizeFrames(frames)) }
}

export function pressBackspace(state: CalcState): CalcState {
  if (state.justEvaluated) {
    return {
      ...state,
      entry: emptyEntry(),
      justEvaluated: false,
      accumulator: 0,
      showSub: false,
    }
  }

  const entry = { ...state.entry }

  if (entry.locked) {
    return { ...state, entry: emptyEntry() }
  }

  if (entry.seconds !== null) {
    if (entry.frameBuffer.length > 0) {
      entry.frameBuffer = entry.frameBuffer.slice(0, -1)
      return { ...state, entry }
    }
    entry.buffer = entry.seconds === 0 ? '' : String(entry.seconds)
    entry.seconds = null
    entry.frameBuffer = ''
    return { ...state, entry }
  }

  if (entry.buffer.length > 0) {
    entry.buffer = entry.buffer.slice(0, -1)
    return { ...state, entry }
  }

  return state
}

export function pressClearEntry(state: CalcState): CalcState {
  return {
    ...state,
    entry: emptyEntry(),
    justEvaluated: false,
  }
}

export function pressAllClear(_state: CalcState): CalcState {
  return initialState()
}

/**
 * +/- immediately folds the current entry into the accumulator.
 * First op with no prior sub: accumulator becomes ±entry.
 * Subsequent ops: accumulator ± entry.
 */
function applyOp(state: CalcState, op: Op): CalcState {
  if (state.justEvaluated) {
    // Continue from result — wait for next entry, keep total as base.
    return {
      ...state,
      entry: emptyEntry(),
      showSub: true,
      justEvaluated: false,
    }
  }

  const base = state.showSub ? state.accumulator : 0
  const delta = hasEntryInput(state.entry)
    ? entryToTotalFrames(state.entry)
    : 0
  const nextAcc = clampTotalFrames(base + (op === '+' ? delta : -delta))

  return {
    entry: emptyEntry(),
    accumulator: nextAcc,
    showSub: true,
    justEvaluated: false,
  }
}

export function pressPlus(state: CalcState): CalcState {
  return applyOp(state, '+')
}

export function pressMinus(state: CalcState): CalcState {
  return applyOp(state, '-')
}

/**
 * = shows the grand total on the main display and hides the sub.
 * Pending entry (without a prior +/-) becomes the result as-is.
 * Pending entry after +/- is added into the accumulator once more.
 */
export function pressEquals(state: CalcState): CalcState {
  if (state.justEvaluated) return state

  let acc = state.accumulator

  if (hasEntryInput(state.entry)) {
    if (state.showSub) {
      acc = clampTotalFrames(acc + entryToTotalFrames(state.entry))
    } else {
      acc = entryToTotalFrames(state.entry)
    }
  }

  return {
    entry: lockParts(fromTotalFrames(acc)),
    accumulator: acc,
    showSub: false,
    justEvaluated: true,
  }
}

export function getMainParts(state: CalcState): TimeParts {
  if (state.justEvaluated) {
    return fromTotalFrames(state.accumulator)
  }
  return entryToParts(state.entry)
}

export function getSubParts(state: CalcState): TimeParts | null {
  if (!state.showSub) return null
  return fromTotalFrames(state.accumulator)
}

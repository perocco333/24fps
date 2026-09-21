import {
  FPS,
  MAX_SECONDS,
  ZERO_PARTS,
  clampTotalFrames,
  fromTotalFrames,
  toTotalFrames,
  type TimeParts,
} from './time'

export type Op = '+' | '-'

/**
 * Seconds-first entry:
 * - Digit keys append to the seconds field (123 → 123秒＋00K).
 * - S / K switch to frame entry (further digits fill K, 0–23).
 * - Shortcuts (6K/12K/18K) set the frame field, keeping current seconds.
 * - + / - / = confirm the current entry as-is (seconds + frames).
 */
export type EntryState = {
  secDigits: string
  frameDigits: string
  /** Where the next digit goes. */
  phase: 'sec' | 'frame'
  locked: boolean
  lockedParts: TimeParts | null
  negative: boolean
}

export type CalcState = {
  entry: EntryState
  accumulator: number
  showSub: boolean
  justEvaluated: boolean
  pendingOp: Op | null
}

export function emptyEntry(negative = false): EntryState {
  return {
    secDigits: '',
    frameDigits: '',
    phase: 'sec',
    locked: false,
    lockedParts: null,
    negative,
  }
}

export function initialState(): CalcState {
  return {
    entry: emptyEntry(),
    accumulator: 0,
    showSub: false,
    justEvaluated: false,
    pendingOp: null,
  }
}

function parseSeconds(digits: string): number {
  if (digits === '') return 0
  const n = parseInt(digits, 10)
  if (Number.isNaN(n)) return 0
  return Math.min(MAX_SECONDS, Math.max(0, n))
}

function parseFrames(digits: string): number {
  if (digits === '') return 0
  const n = parseInt(digits, 10)
  if (Number.isNaN(n)) return 0
  return Math.min(FPS - 1, Math.max(0, n))
}

export function entryToParts(entry: EntryState): TimeParts {
  if (entry.locked && entry.lockedParts) {
    return entry.lockedParts
  }
  return {
    negative: entry.negative,
    seconds: parseSeconds(entry.secDigits),
    frames: parseFrames(entry.frameDigits),
  }
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
  if (entry.negative && entry.secDigits === '' && entry.frameDigits === '') {
    return false
  }
  return entry.secDigits !== '' || entry.frameDigits !== ''
}

function lockParts(parts: TimeParts): EntryState {
  return {
    secDigits: '',
    frameDigits: '',
    phase: 'sec',
    locked: true,
    lockedParts: { ...parts },
    negative: parts.negative,
  }
}

function prepareForNewEntry(state: CalcState): CalcState {
  if (!state.justEvaluated) return state
  return {
    ...state,
    entry: emptyEntry(),
    accumulator: 0,
    showSub: false,
    justEvaluated: false,
    pendingOp: null,
  }
}

function unlockIfNeeded(state: CalcState): CalcState {
  if (!state.entry.locked) return state
  return { ...state, entry: emptyEntry(state.entry.negative) }
}

export function pressDigit(state: CalcState, digit: string): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  const entry = { ...s.entry }

  if (entry.phase === 'sec') {
    if (entry.secDigits.length >= 4) return s
    const next =
      entry.secDigits === '0' ? digit : entry.secDigits + digit
    const value = parseInt(next, 10)
    if (Number.isNaN(value) || value > MAX_SECONDS) return s
    entry.secDigits = next
    return { ...s, entry }
  }

  // frame phase
  if (entry.frameDigits.length >= 2) return s
  const candidate = entry.frameDigits + digit
  if (parseInt(candidate, 10) > FPS - 1) return s
  entry.frameDigits = candidate
  return { ...s, entry }
}

/** S: keep seconds as typed, further digits go to frames. */
export function pressS(state: CalcState): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  return {
    ...s,
    entry: {
      ...s.entry,
      phase: 'frame',
      locked: false,
      lockedParts: null,
    },
  }
}

/** K: switch to frame entry (same unit gate as S under seconds-first). */
export function pressK(state: CalcState): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  return {
    ...s,
    entry: {
      ...s.entry,
      phase: 'frame',
      locked: false,
      lockedParts: null,
    },
  }
}

/**
 * Shortcuts set the frame field (6 / 12 / 18), keeping seconds digits.
 */
export function pressShortcut(
  state: CalcState,
  frames: 6 | 12 | 18,
): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  return {
    ...s,
    entry: {
      ...s.entry,
      frameDigits: String(frames),
      phase: 'frame',
      locked: false,
      lockedParts: null,
    },
  }
}

export function pressBackspace(state: CalcState): CalcState {
  if (state.justEvaluated) {
    return initialState()
  }

  const entry = { ...state.entry }

  if (entry.locked) {
    return { ...state, entry: emptyEntry(entry.negative) }
  }

  if (entry.phase === 'frame') {
    if (entry.frameDigits.length > 0) {
      entry.frameDigits = entry.frameDigits.slice(0, -1)
      return { ...state, entry }
    }
    // Leave frame phase back to seconds editing.
    entry.phase = 'sec'
    return { ...state, entry }
  }

  if (entry.secDigits.length > 0) {
    entry.secDigits = entry.secDigits.slice(0, -1)
    return { ...state, entry }
  }

  if (entry.negative) {
    entry.negative = false
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

function applyPending(acc: number, op: Op | null, value: number): number {
  if (op === '-') return clampTotalFrames(acc - value)
  return clampTotalFrames(acc + value)
}

function confirmWithOp(state: CalcState, nextOp: Op): CalcState {
  if (state.justEvaluated) {
    return {
      entry: emptyEntry(),
      accumulator: state.accumulator,
      showSub: true,
      justEvaluated: false,
      pendingOp: nextOp,
    }
  }

  let acc = state.accumulator
  if (hasEntryInput(state.entry)) {
    const value = entryToTotalFrames(state.entry)
    if (state.pendingOp !== null || state.showSub) {
      acc = applyPending(acc, state.pendingOp ?? '+', value)
    } else {
      acc = value
    }
  }

  return {
    entry: emptyEntry(),
    accumulator: acc,
    showSub: true,
    justEvaluated: false,
    pendingOp: nextOp,
  }
}

export function pressPlus(state: CalcState): CalcState {
  return confirmWithOp(state, '+')
}

/**
 * - with no existing value → unary minus
 * - with an existing value → subtraction
 */
export function pressMinus(state: CalcState): CalcState {
  if (state.justEvaluated) {
    return {
      entry: emptyEntry(),
      accumulator: state.accumulator,
      showSub: true,
      justEvaluated: false,
      pendingOp: '-',
    }
  }

  const hasValue =
    hasEntryInput(state.entry) ||
    state.showSub ||
    state.pendingOp !== null

  if (!hasValue) {
    return {
      ...state,
      entry: emptyEntry(true),
      justEvaluated: false,
    }
  }

  return confirmWithOp(state, '-')
}

export function pressEquals(state: CalcState): CalcState {
  if (state.justEvaluated) return state

  let acc = state.accumulator

  if (hasEntryInput(state.entry)) {
    const value = entryToTotalFrames(state.entry)
    if (state.pendingOp !== null || state.showSub) {
      acc = applyPending(acc, state.pendingOp ?? '+', value)
    } else {
      acc = value
    }
  }

  return {
    entry: lockParts(fromTotalFrames(acc)),
    accumulator: acc,
    showSub: false,
    justEvaluated: true,
    pendingOp: null,
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

// Re-export zero for tests that may reference display of empty entry
export { ZERO_PARTS }

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
 * Digit entry uses a "push" model:
 * - Last 2 digits = frames (0–23); digits to the left = seconds.
 * - Typing a digit that would make frames > 23 is rejected.
 * - After S, the current buffer becomes seconds and further digits/shortcuts
 *   only fill the frame slots.
 * - Shortcuts (6k/12k/18k) inject their digits into the frame slots.
 * - + / - / = confirm the current entry.
 */
export type EntryState = {
  /** Digits before S (or the full push buffer when S was not used). */
  buffer: string
  /** Set when S was pressed — seconds are locked. */
  seconds: number | null
  /** Frame digits after S (0–2 chars). */
  frameBuffer: string
  /** Explicit lock after K / =. */
  locked: boolean
  lockedParts: TimeParts | null
  /** Unary minus while composing an entry. */
  negative: boolean
}

export type CalcState = {
  entry: EntryState
  accumulator: number
  showSub: boolean
  justEvaluated: boolean
  /** Operator waiting for the next operand. */
  pendingOp: Op | null
}

export function emptyEntry(negative = false): EntryState {
  return {
    buffer: '',
    seconds: null,
    frameBuffer: '',
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

/** Parse push-buffer / S-mode into display parts (magnitude only). */
function partsFromDigits(
  buffer: string,
  seconds: number | null,
  frameBuffer: string,
): TimeParts {
  if (seconds !== null) {
    const frames =
      frameBuffer === '' ? 0 : parseInt(frameBuffer, 10)
    return {
      negative: false,
      seconds: Math.min(MAX_SECONDS, Math.max(0, seconds)),
      frames: Number.isNaN(frames) ? 0 : Math.min(FPS - 1, frames),
    }
  }

  if (buffer === '') {
    return ZERO_PARTS
  }

  if (buffer.length <= 2) {
    const frames = parseInt(buffer, 10)
    return {
      negative: false,
      seconds: 0,
      frames: Number.isNaN(frames) ? 0 : frames,
    }
  }

  const frameStr = buffer.slice(-2)
  const secStr = buffer.slice(0, -2)
  const frames = parseInt(frameStr, 10)
  const secs = parseInt(secStr, 10)
  return {
    negative: false,
    seconds: Number.isNaN(secs) ? 0 : Math.min(MAX_SECONDS, secs),
    frames: Number.isNaN(frames) ? 0 : frames,
  }
}

/** Would appending `digit` to the push buffer produce frames > 23? */
function wouldRejectPushDigit(buffer: string, digit: string): boolean {
  const next = (buffer === '0' ? '' : buffer) + digit
  if (next.length <= 2) {
    const frames = parseInt(next, 10)
    return Number.isNaN(frames) || frames > FPS - 1
  }
  if (next.length > 6) return true // 9999 + 23
  const frameStr = next.slice(-2)
  const secStr = next.slice(0, -2)
  const frames = parseInt(frameStr, 10)
  const secs = parseInt(secStr, 10)
  if (Number.isNaN(frames) || frames > FPS - 1) return true
  if (Number.isNaN(secs) || secs > MAX_SECONDS) return true
  return false
}

export function entryToParts(entry: EntryState): TimeParts {
  if (entry.locked && entry.lockedParts) {
    return entry.lockedParts
  }
  const mag = partsFromDigits(entry.buffer, entry.seconds, entry.frameBuffer)
  return { ...mag, negative: entry.negative }
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
  if (entry.negative && entry.buffer === '' && entry.frameBuffer === '') {
    // Unary minus alone is not yet a committed value.
    return false
  }
  return entry.buffer !== '' || entry.frameBuffer !== ''
}

function lockParts(parts: TimeParts): EntryState {
  return {
    buffer: '',
    seconds: null,
    frameBuffer: '',
    locked: true,
    lockedParts: { ...parts },
    negative: parts.negative,
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
    pendingOp: null,
  }
}

function unlockIfNeeded(state: CalcState): CalcState {
  if (!state.entry.locked) return state
  const neg = state.entry.negative
  return { ...state, entry: emptyEntry(neg) }
}

/** Append one digit into frame slots (push model or post-S). */
function appendFrameDigit(entry: EntryState, digit: string): EntryState | null {
  if (entry.seconds !== null) {
    if (entry.frameBuffer.length >= 2) return null
    const candidate = entry.frameBuffer + digit
    if (parseInt(candidate, 10) > FPS - 1) return null
    return { ...entry, frameBuffer: candidate, locked: false, lockedParts: null }
  }

  if (wouldRejectPushDigit(entry.buffer, digit)) return null
  const next = (entry.buffer === '0' ? '' : entry.buffer) + digit
  return { ...entry, buffer: next, locked: false, lockedParts: null }
}

export function pressDigit(state: CalcState, digit: string): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  const next = appendFrameDigit(s.entry, digit)
  if (!next) return s
  return { ...s, entry: next }
}

export function pressS(state: CalcState): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)

  if (s.entry.seconds !== null) return s

  // Digits typed so far become seconds; further digits fill frames.
  const sec =
    s.entry.buffer === '' ? 0 : parseInt(s.entry.buffer, 10)
  if (Number.isNaN(sec)) return s

  return {
    ...s,
    entry: {
      ...s.entry,
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
  // Confirm current magnitude as frames/seconds display (explicit K).
  const parts = entryToParts(s.entry)
  return { ...s, entry: lockParts(parts) }
}

/**
 * Shortcuts inject their decimal digits into the frame slots
 * (same as typing those digits), preserving seconds after S.
 */
export function pressShortcut(
  state: CalcState,
  frames: 6 | 12 | 18,
): CalcState {
  let s = prepareForNewEntry(state)
  s = unlockIfNeeded(s)
  const digits = String(frames)
  let entry = s.entry
  for (const d of digits) {
    const next = appendFrameDigit(entry, d)
    if (!next) break
    entry = next
  }
  return { ...s, entry }
}

export function pressBackspace(state: CalcState): CalcState {
  if (state.justEvaluated) {
    return initialState()
  }

  const entry = { ...state.entry }

  if (entry.locked) {
    return { ...state, entry: emptyEntry(entry.negative) }
  }

  if (entry.seconds !== null) {
    if (entry.frameBuffer.length > 0) {
      entry.frameBuffer = entry.frameBuffer.slice(0, -1)
      return { ...state, entry }
    }
    // Undo S: restore seconds digits into buffer.
    entry.buffer = entry.seconds === 0 ? '' : String(entry.seconds)
    entry.seconds = null
    entry.frameBuffer = ''
    return { ...state, entry }
  }

  if (entry.buffer.length > 0) {
    entry.buffer = entry.buffer.slice(0, -1)
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
  // '+' or null with a value to fold in → add
  return clampTotalFrames(acc + value)
}

/**
 * Confirm current entry into the running total using pendingOp,
 * then set a new pending operator (for + / -).
 */
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
  const hadEntry = hasEntryInput(state.entry)

  if (hadEntry) {
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
 * - with no existing value → unary minus (negative number input)
 * - with an existing value (entry, sub, or just-evaluated result) → subtraction
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
  } else if (state.pendingOp !== null && state.showSub) {
    // No new entry — keep accumulator as result.
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
  // Show unary-minus zero while waiting for digits.
  return entryToParts(state.entry)
}

export function getSubParts(state: CalcState): TimeParts | null {
  if (!state.showSub) return null
  return fromTotalFrames(state.accumulator)
}

import {
  entryToParts,
  getMainParts,
  getSubParts,
  initialState,
  pressAllClear,
  pressDigit,
  pressEquals,
  pressK,
  pressMinus,
  pressPlus,
  pressS,
  pressShortcut,
} from '../src/lib/calculator'
import { formatMain, formatSub, fromTotalFrames } from '../src/lib/time'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function mainLabel(state: ReturnType<typeof initialState>) {
  const m = formatMain(getMainParts(state))
  return `${m.sign}${m.seconds}秒＋${m.frames}K`
}

let s = initialState()
assert(mainLabel(s) === '0秒＋00K', 'initial main')
assert(getSubParts(s) === null, 'initial sub hidden')

// 12 -> 12K
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '0秒＋12K', '12 as frames')

// 1 S 1 2 -> 1秒＋12K
s = initialState()
s = pressDigit(s, '1')
s = pressS(s)
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '1秒＋12K', '1s 12k')

// shortcut + accumulate
s = initialState()
s = pressShortcut(s, 12)
s = pressPlus(s)
assert(formatSub(getSubParts(s)!) === '0+12', 'sub after +')
s = pressShortcut(s, 6)
s = pressPlus(s)
assert(formatSub(getSubParts(s)!) === '0+18', 'sub 18k')
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋18K', 'equals main')
assert(getSubParts(s) === null, 'sub cleared')

// negative
s = initialState()
s = pressShortcut(s, 6)
s = pressMinus(s)
assert(formatSub(getSubParts(s)!) === '-0+6', 'neg sub')
s = pressEquals(s)
assert(mainLabel(s) === '-0秒＋06K', 'neg main')

// carry 24 frames
assert(
  formatMain(fromTotalFrames(24)).seconds === '1' &&
    formatMain(fromTotalFrames(24)).frames === '00',
  '24 frames = 1s',
)

// AC
s = pressAllClear(s)
assert(mainLabel(s) === '0秒＋00K', 'ac main')
assert(getSubParts(s) === null, 'ac sub')

// after = digit clears
s = pressShortcut(initialState(), 12)
s = pressEquals(s)
s = pressDigit(s, '6')
assert(mainLabel(s) === '0秒＋06K', 'new calc after =')
assert(getSubParts(s) === null, 'sub gone after new calc')

// 25 frames normalizes
s = initialState()
s = pressDigit(s, '2')
s = pressDigit(s, '5')
assert(mainLabel(s) === '1秒＋01K', '25 frames normalize')

// K explicit
s = initialState()
s = pressDigit(s, '1')
s = pressDigit(s, '8')
s = pressK(s)
assert(entryToParts(s.entry).frames === 18, 'K lock')

console.log('All calculator tests passed')

import {
  entryToParts,
  getMainParts,
  getSubParts,
  initialState,
  pressAllClear,
  pressDigit,
  pressEquals,
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

// Push model: 12 → 0+12
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '0秒＋12K', '12 as frames')

// 123 → 1+23
s = pressDigit(s, '3')
assert(mainLabel(s) === '1秒＋23K', '123 pushes to 1+23')

// Reject digit that would make frames > 23 (e.g. 125)
s = initialState()
s = pressDigit(s, '1')
s = pressDigit(s, '2')
s = pressDigit(s, '5')
assert(mainLabel(s) === '0秒＋12K', 'reject 5 after 12')

// 1 S 1 2 → 1秒＋12K
s = initialState()
s = pressDigit(s, '1')
s = pressS(s)
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '1秒＋12K', '1s 12k')

// 4 S 18k → 4+18
s = initialState()
s = pressDigit(s, '4')
s = pressS(s)
s = pressShortcut(s, 18)
assert(mainLabel(s) === '4秒＋18K', '4 S 18k')

// shortcut alone
s = initialState()
s = pressShortcut(s, 12)
assert(mainLabel(s) === '0秒＋12K', '12k shortcut')

// add chain: 12k + 6k =
s = initialState()
s = pressShortcut(s, 12)
s = pressPlus(s)
assert(formatSub(getSubParts(s)!) === '0+12', 'sub after +')
s = pressShortcut(s, 6)
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋18K', '12+6=18')
assert(getSubParts(s) === null, 'sub cleared')

// binary minus: 12k - 6k =
s = initialState()
s = pressShortcut(s, 12)
s = pressMinus(s)
assert(formatSub(getSubParts(s)!) === '0+12', 'sub after binary -')
s = pressShortcut(s, 6)
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋06K', '12-6=6')

// unary minus: - 12k =
s = initialState()
s = pressMinus(s)
assert(mainLabel(s) === '-0秒＋00K', 'unary minus shown')
s = pressShortcut(s, 12)
assert(mainLabel(s) === '-0秒＋12K', 'negative entry')
s = pressEquals(s)
assert(mainLabel(s) === '-0秒＋12K', 'unary equals')

// 24 frames carry in total (fromTotalFrames)
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

// after = then - continues subtract from result
s = initialState()
s = pressShortcut(s, 18)
s = pressEquals(s)
s = pressMinus(s)
s = pressShortcut(s, 6)
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋12K', '18-6 after equals continue')

console.log('All calculator tests passed')

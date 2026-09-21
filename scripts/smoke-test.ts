import {
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

// Digits are seconds: 12 → 12秒＋00K
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '12秒＋00K', '12 as seconds')

// 123 stays 123 seconds (no push to frames)
s = pressDigit(s, '3')
assert(mainLabel(s) === '123秒＋00K', '123 as seconds')

// 1 → 12K → 1＋12
s = initialState()
s = pressDigit(s, '1')
s = pressShortcut(s, 12)
assert(mainLabel(s) === '1秒＋12K', '1 then 12K')

// 10 → 6K → 10＋06
s = initialState()
s = pressDigit(s, '1')
s = pressDigit(s, '0')
s = pressShortcut(s, 6)
assert(mainLabel(s) === '10秒＋06K', '10 then 6K')

// 7 → + confirms as 7 seconds
s = initialState()
s = pressDigit(s, '7')
s = pressPlus(s)
assert(formatSub(getSubParts(s)!) === '7+0', '7 + confirms seconds')

// 10 S 12 → 10秒＋12K
s = initialState()
s = pressDigit(s, '1')
s = pressDigit(s, '0')
s = pressS(s)
s = pressDigit(s, '1')
s = pressDigit(s, '2')
assert(mainLabel(s) === '10秒＋12K', '10 S 12')

// add: 12K + 6K =
s = initialState()
s = pressShortcut(s, 12)
s = pressPlus(s)
assert(formatSub(getSubParts(s)!) === '0+12', 'sub after +')
s = pressShortcut(s, 6)
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋18K', '12+6=18')

// binary minus: 12K - 6K =
s = initialState()
s = pressShortcut(s, 12)
s = pressMinus(s)
s = pressShortcut(s, 6)
s = pressEquals(s)
assert(mainLabel(s) === '0秒＋06K', '12-6=6')

// unary minus
s = initialState()
s = pressMinus(s)
s = pressShortcut(s, 12)
s = pressEquals(s)
assert(mainLabel(s) === '-0秒＋12K', 'unary -12K')

assert(
  formatMain(fromTotalFrames(24)).seconds === '1' &&
    formatMain(fromTotalFrames(24)).frames === '00',
  '24 frames = 1s',
)

s = pressAllClear(s)
assert(mainLabel(s) === '0秒＋00K', 'ac main')

// after = digit starts new calc
s = pressShortcut(initialState(), 12)
s = pressEquals(s)
s = pressDigit(s, '6')
assert(mainLabel(s) === '6秒＋00K', 'new calc digit is seconds')

console.log('All calculator tests passed')

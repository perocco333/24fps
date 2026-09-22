import { useReducer } from 'react'
import {
  getMainParts,
  getSubParts,
  initialState,
  pressAllClear,
  pressBackspace,
  pressClearEntry,
  pressDigit,
  pressEquals,
  pressK,
  pressMinus,
  pressPlus,
  pressS,
  pressShortcut,
  type CalcState,
} from './lib/calculator'
import { formatMain, formatSub } from './lib/time'
import './App.css'

type Action =
  | { type: 'digit'; digit: string }
  | { type: 's' }
  | { type: 'k' }
  | { type: 'shortcut'; frames: 6 | 12 | 18 }
  | { type: 'backspace' }
  | { type: 'c' }
  | { type: 'ac' }
  | { type: 'plus' }
  | { type: 'minus' }
  | { type: 'equals' }

function reducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case 'digit':
      return pressDigit(state, action.digit)
    case 's':
      return pressS(state)
    case 'k':
      return pressK(state)
    case 'shortcut':
      return pressShortcut(state, action.frames)
    case 'backspace':
      return pressBackspace(state)
    case 'c':
      return pressClearEntry(state)
    case 'ac':
      return pressAllClear(state)
    case 'plus':
      return pressPlus(state)
    case 'minus':
      return pressMinus(state)
    case 'equals':
      return pressEquals(state)
  }
}

function Display({ state }: { state: CalcState }) {
  const main = formatMain(getMainParts(state))
  const sub = getSubParts(state)

  return (
    <div className="display" aria-live="polite">
      <div className="display-main">
        <span className="sign">{main.sign || '\u00a0'}</span>
        <span className="seconds">
          <span className="num">{main.seconds}</span>
          <span className="unit">秒</span>
        </span>
        <span className="plus" aria-hidden="true">
          ＋
        </span>
        <span className="frames">
          <span className="num">{main.frames}</span>
          <span className="unit">K</span>
        </span>
      </div>
      <div className={`display-sub${sub ? '' : ' is-empty'}`}>
        {sub ? formatSub(sub) : '\u00a0'}
      </div>
    </div>
  )
}

type KeyDef =
  | {
      id: string
      label: string
      className: string
      action: Action
      span?: 'plus' | 'eq'
    }

const KEYS: KeyDef[] = [
  { id: '7', label: '7', className: 'key num', action: { type: 'digit', digit: '7' } },
  { id: '8', label: '8', className: 'key num', action: { type: 'digit', digit: '8' } },
  { id: '9', label: '9', className: 'key num', action: { type: 'digit', digit: '9' } },
  { id: 'bs', label: '▶', className: 'key backspace', action: { type: 'backspace' } },
  { id: 'ac', label: 'AC', className: 'key ac', action: { type: 'ac' } },

  { id: '4', label: '4', className: 'key num', action: { type: 'digit', digit: '4' } },
  { id: '5', label: '5', className: 'key num', action: { type: 'digit', digit: '5' } },
  { id: '6', label: '6', className: 'key num', action: { type: 'digit', digit: '6' } },
  { id: '18k', label: '18K', className: 'key shortcut', action: { type: 'shortcut', frames: 18 } },
  { id: 'c', label: 'C', className: 'key clear', action: { type: 'c' } },

  { id: '1', label: '1', className: 'key num', action: { type: 'digit', digit: '1' } },
  { id: '2', label: '2', className: 'key num', action: { type: 'digit', digit: '2' } },
  { id: '3', label: '3', className: 'key num', action: { type: 'digit', digit: '3' } },
  { id: '12k', label: '12K', className: 'key shortcut', action: { type: 'shortcut', frames: 12 } },
  { id: 's', label: 'S', className: 'key unit', action: { type: 's' } },

  { id: '0', label: '0', className: 'key num', action: { type: 'digit', digit: '0' } },
  { id: 'plus', label: '＋', className: 'key op plus', action: { type: 'plus' }, span: 'plus' },
  { id: '6k', label: '6K', className: 'key shortcut', action: { type: 'shortcut', frames: 6 } },
  { id: 'k', label: 'K', className: 'key unit', action: { type: 'k' } },

  { id: 'minus', label: '−', className: 'key op', action: { type: 'minus' } },
  { id: 'eq', label: '＝', className: 'key op eq', action: { type: 'equals' }, span: 'eq' },
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  return (
    <div className="app">
      <div className="phone">
        <Display state={state} />
        <div className="keypad" role="group" aria-label="キーパッド">
          {KEYS.map((key) => (
            <button
              key={key.id}
              type="button"
              className={`${key.className}${key.span ? ` span-${key.span}` : ''}`}
              onClick={() => dispatch(key.action)}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

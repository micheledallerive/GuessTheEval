import React from 'react'
import './App.css'
import Chessground from '@react-chess/chessground'
import Bar from './Bar'

const Chess = require('chess.js')

// loading Stockfish for the board evaluation
const wasmSupported =
  typeof WebAssembly === 'object' &&
  WebAssembly.validate(
    Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
  )
const stockfish = new Worker(
  wasmSupported ? './stockfish.wasm.js' : './stockfish.js'
)

function getRandom (array) {
  return array[Math.floor(Math.random() * array.length)]
}

function roundToOneDecimal (num) {
  return +(Math.round(num + 'e+1') + 'e-1')
}

function evaluate (fen) {
  stockfish.postMessage('uci')
  stockfish.postMessage('ucinewgame')
  stockfish.postMessage('position fen ' + fen)
  stockfish.postMessage('go depth 20')
}

function setupStockfish () {
  stockfish.addEventListener('message', e => {
    const parts = e.data.split(' ')
    const depth = parseInt(parts[2])
    if (parts[1] === 'depth' && depth >= 20) {
      // get stockfish evaluation from the stockfish message
      let e = roundToOneDecimal(parseInt(parts[9]) / 100)

      /* Stockfish evaluates the board considering the current player.
         The real evaluation is negative if black has an advantage,
         therefore it must be inverted if I'm playing with black */
      e = this.state.originalColor === 'b' ? -e : e

      this.setState({ loading: false, evaluation: e })

      // stop stockfish execution
      stockfish.postMessage('stop')
    }
  })
}

class App extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      // if the game is loading and evaluating the position
      loading: true,
      // contains the chess.js instance of the current game
      chess: null,
      // contains the random picked fen of the starting position
      pickedFen: '',
      // contains the color of the player in the random picked position
      originalColor: '',
      /* contains a history of the moves execute by the player
         in order to allow undo and redo */
      movesHistory: [],
      // contains the value that the player guessed being the evaluation
      guess: 0,
      // if the player has submitted is guess or not
      guessed: false,
      // contains the actual evaluation of the position
      evaluation: 0
    }
    setupStockfish.bind(this)()
  }

  async componentDidMount () {
    // fetches a lichess study where to get the positions from
    fetch('https://lichess.org/api/study/E954Ai0N.pgn')
      .then(res => res.text())
      .then(data => {
        // gets the list of the pgns
        const pgns = data.split('\n\n\n')
        const pgn = getRandom(pgns)

        const randomGame = new Chess()
        randomGame.load_pgn(pgn)
        const history = randomGame.history()

        const chess = Chess()

        const randomOffset = Math.floor((Math.random() - 0.75) * 8)
        // takes a random position around 80% of the game
        const randomChosenMove =
          Math.floor((history.length * 4) / 5) + randomOffset

        /* executes all the moves of the picked game in order to get the fen
           of the randomly picked position */
        for (let i = 0; i < randomChosenMove; i++) {
          chess.move(history[i])
        }

        evaluate(chess.fen())
        console.log(chess.fen())
        this.setState({
          loading: true,
          chess: new Chess(chess.fen()),
          pickedFen: chess.fen(),
          originalColor: chess.turn(),
          stockfish: stockfish
        })
      })
  }

  /**
   * Chess.js and Chessground use two different ways to get the available moves
   * - Chess.js uses a list of available destinations where the pieces can be moved to
   * - Chessground uses a Map that has as key the original square, and as value all the
   *   square where the piece in the original square can move to
   * In order to display the possible moves from a specific square in Chessground I need
   * to translate the Chess.js available moves to Chessground available moves.
   * @returns {Map<string, string[]>} the map of the available moves
   */
  generateDests () {
    const verboseMoves = this.state.chess.moves({ verbose: true })
    const dests = {}
    verboseMoves.forEach(move => {
      if (move.color === this.state.chess.turn()) {
        if (move.from in dests) dests[move.from].push(move.to)
        else dests[move.from] = [move.to]
      }
    })
    const mapDests = new Map()
    Object.keys(dests).forEach(key => {
      mapDests.set(key, dests[key])
    })
    return mapDests
  }

  render () {
    return (
      <>
        {this.state.loading
          ? (
            <>
              <div
                className='spinner-border'
                role='status'
                style={{ width: 48, height: 48 }}
              >
                <span className='sr-only'>Loading...</span>
              </div>
            </>
            )
          : (
            <>
              <div id='container'>
                <div
                  className='w-100 text-center'
                  style={{ lineBreak: 'anywhere' }}
                >
                  Scroll the evaluation bar to guess the evaluation of this
                  position.
                  <br />(<b>Remember</b>: A negative value means that black is
                  winning)
                </div>
                <div
                  className='chessboard d-flex flex-row mt-2'
                  onClick={() => {
                    /* if my guessed message box is open, i want to close it when i click
                       the chessboard otherwise it glitches */
                    if (this.state.guessed) this.setState({ guessed: false })
                  }}
                >
                  <Chessground
                    config={{
                      fen: this.state.chess.fen(), // the current fen of the chessboard
                      orientation:
                      this.state.originalColor === 'w' ? 'white' : 'black',
                      turnColor:
                      this.state.chess.turn() === 'w' ? 'white' : 'black',
                      check: this.state.chess.in_check(),
                      addDimensionsCssVars: true,
                      disableContextMenu: true,
                      animation: {
                        enabled: true,
                        duration: 250
                      },
                      highlight: {
                        lastMove: true,
                        check: true
                      },
                      movable: {
                        free: false,
                        color:
                        this.state.chess.turn() === 'w' ? 'white' : 'black',
                        dests: this.generateDests(), // generates the available destinations
                        showDests: true,
                        events: {
                          after: (orig, dest, meta) => {
                            this.setState(oldState => {
                              let movesh = oldState.movesHistory
                              const nextMove = movesh.pop()
                              const move = {
                                from: orig,
                                to: dest,
                                promotion: 'q'
                              }
                              /* if I went back in the move history and I'm doing a different move
                                 than the next move in the history, I reset the move history */
                              if (move !== nextMove) movesh = []

                              const c = oldState.chess
                              c.move(move)
                              return { chess: c, movesHistory: movesh }
                            })
                          }
                        }
                      }
                    }}
                    className='chessboard'
                  />
                  <Bar
                    values={[0]}
                    onChange={value =>
                      this.setState({ guessed: false, guess: value })}
                    turn={this.state.originalColor}
                  />
                </div>
                <div
                  className='w-100 mt-2 d-flex justify-content-between align-items-center'
                  style={{ paddingRight: '40px' }}
                >
                  <div className='d-flex flex-row' style={{ gap: '16px' }}>
                    <button
                      disabled={this.state.chess.fen() === this.state.pickedFen}
                      onClick={() => {
                        this.setState(oldState => {
                          const c = oldState.chess
                          const undoedMove = c.undo()
                          if (undoedMove) {
                            /* if I undo a move, I want to push it to the moves history
                               in order to be able to redo it if I want to */
                            const newMoves = oldState.movesHistory
                            newMoves.push({
                              from: undoedMove.from,
                              to: undoedMove.to
                            })
                            return { chess: c, movesHistory: newMoves }
                          } else return oldState
                        })
                      }}
                      className='btn btn-primary'
                    >
                      &lt; Undo{' '}
                    </button>
                    <button
                      disabled={this.state.movesHistory.length === 0}
                      onClick={() => {
                        this.setState(oldState => {
                          const c = oldState.chess
                          const mvs = oldState.movesHistory
                          const redoedMove = mvs.pop()
                          /* the move the redo is just the last move in the moves history,
                             which is just the last move execute */
                          c.move(redoedMove)
                          return { chess: c, movesHistory: mvs }
                        })
                      }}
                      className='btn btn-primary'
                    >
                      Redo &gt;{' '}
                    </button>
                    <button
                      disabled={this.state.pickedFen === this.state.chess.fen()}
                      onClick={() => {
                        this.setState(prevState => {
                          return { chess: new Chess(prevState.pickedFen) }
                        })
                      }}
                      className='btn btn-primary'
                    >
                      Reset
                    </button>
                  </div>
                  <button
                    onClick={() => this.setState({ guessed: true })}
                    className='btn btn-success'
                  >
                    Submit
                  </button>
                </div>
                {this.state.guessed
                  ? (
                    <div
                      style={{ position: 'relative' }}
                      className={
                          'w-100 mt-3 row text-center alert ' +
                          (this.state.guess === this.state.evaluation
                            ? 'alert-success'
                            : 'alert-danger')
                        }
                    >
                      <div className='col-8'>
                        {this.state.guess === this.state.evaluation
                          ? 'You guessed the right evaluation!'
                          : 'You missed the correct evaluation by ' +
                          roundToOneDecimal(
                            Math.abs(this.state.guess - this.state.evaluation)
                          )}
                        <br />
                        The position evaluation is {this.state.evaluation}.
                      </div>
                      <div className='col-4'>
                        <button
                          onClick={() => document.location.reload()}
                          className='mt-2 btn btn-primary'
                        >
                          New game
                        </button>
                      </div>
                    </div>
                    )
                  : (
                    <></>
                    )}
              </div>
            </>
            )}
      </>
    )
  }
}

export default App

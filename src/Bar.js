import React from 'react'
import { Direction, Range, getTrackBackground } from 'react-range'

export default class Bar extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      values: [0]
    }
  }

  render () {
    const MIN = -20
    const MAX = 20
    return (
      <>
        <div
          style={{
            width: '40px',
            height: '600px',
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Range
            step={0.1}
            min={MIN}
            max={MAX}
            direction={this.props.turn === 'w' ? Direction.Up : Direction.Down}
            values={this.state.values}
            onChange={values => {
              this.setState({ values: values })
              this.props.onChange(values[0])
            }}
            renderTrack={({ props, children }) => (
              <div
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                style={{
                  ...props.style,
                  height: '100%',
                  display: 'flex',
                  width: '16px',
                  borderRadius: '0px'
                }}
              >
                <div
                  ref={props.ref}
                  style={{
                    height: '570px',
                    width: '100%',
                    borderRadius: '4px',
                    background: getTrackBackground({
                      values: this.state.values,
                      colors: ['#ccc', '#000'],
                      direction:
                        this.props.turn === 'w' ? Direction.Up : Direction.Down,
                      min: MIN,
                      max: MAX
                    })
                  }}
                >
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ props }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: '4px',
                  width: '16px',
                  backgroundColor: '#fff',
                  border: '1px solid black'
                }}
              />
            )}
          />
          <span style={{ marginTop: 0 }}>{this.state.values[0]}</span>
        </div>
      </>
    )
  }
}

# MagicLoading Component

A React component for displaying Lottie animations with enhanced playback control capabilities.

## Features

- ✨ Basic Lottie animation display
- 🎮 Animation playback control (play, pause, stop)
- 🎯 Frame-level position control
- 📱 Section mode with different speed settings
- 🔧 Full access to DotLottie instance API

## Basic Usage

```tsx
import MagicLoading from './MagicLoading'

// Simple loading animation
<MagicLoading />

// Section mode (faster animation)
<MagicLoading section />
```

## Animation Control

### Frame Control

Control the animation position by specifying the current frame:

```tsx
const [currentFrame, setCurrentFrame] = useState(0)

<MagicLoading 
  currentFrame={currentFrame}
  autoplay={false}
/>

// Jump to specific frame
setCurrentFrame(50)
```

### Full Control Access

Get access to the complete DotLottie instance for advanced control:

```tsx
const [dotLottie, setDotLottie] = useState(null)

<MagicLoading 
  onDotLottieRef={setDotLottie}
  autoplay={false}
/>

// Use the instance for control
dotLottie?.play()
dotLottie?.pause()
dotLottie?.stop()
dotLottie?.setFrame(30)
```

### Event Listening

Listen to animation events:

```tsx
const handleDotLottieRef = (dotLottie) => {
  if (dotLottie) {
    dotLottie.addEventListener('play', () => {
      console.log('Animation started')
    })
    
    dotLottie.addEventListener('frame', ({ currentFrame }) => {
      console.log('Current frame:', currentFrame)
    })
    
    dotLottie.addEventListener('complete', () => {
      console.log('Animation completed')
    })
  }
}

<MagicLoading onDotLottieRef={handleDotLottieRef} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `section` | `boolean` | `false` | Enable section mode with 2x speed |
| `size` | `number` | - | Size of the animation |
| `currentFrame` | `number` | - | Control current animation frame |
| `onDotLottieRef` | `(dotLottie: DotLottieInstance \| null) => void` | - | Callback to access DotLottie instance |
| ...rest | `DotLottieReactProps` | - | All other DotLottieReact props |

## DotLottie Instance Methods

The DotLottie instance provides the following methods:

- `play()` - Start/resume animation
- `pause()` - Pause animation
- `stop()` - Stop animation and reset to first frame
- `setFrame(frame: number)` - Jump to specific frame
- `addEventListener(event, callback)` - Listen to events
- `removeEventListener(event, callback)` - Remove event listeners

## DotLottie Instance Properties

- `currentFrame` - Current frame number
- `totalFrames` - Total number of frames
- `isPlaying` - Whether animation is playing
- `isPaused` - Whether animation is paused
- `isStopped` - Whether animation is stopped

## Events

- `load` - Animation loaded
- `play` - Animation started
- `pause` - Animation paused
- `stop` - Animation stopped
- `complete` - Animation completed
- `frame` - Frame changed (provides `{ currentFrame }`)

## Example

See `example.tsx` for a complete interactive example with playback controls. 
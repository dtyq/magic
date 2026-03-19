# VoiceInput Component

## Overview

VoiceInput is a mobile voice input component that supports voice recording, real-time transcription, and text editing functionality. It provides a complete voice-to-text input solution for mobile chat applications.

## Features

- **Voice Recording**: Press and hold to record voice messages
- **Gesture Recognition**: Support for cancel and send-text gestures
- **Real-time Transcription**: Convert speech to text in real-time
- **Text Editing**: Edit transcribed text before sending
- **Dual Mode**: Send either voice or text messages
- **Mobile Optimized**: Designed specifically for mobile touch interactions
- **Internationalization**: Full i18n support for multiple languages

## Architecture

The component follows a modular architecture with clear separation of concerns:

```
VoiceInput/
├── index.tsx                 # Main component
├── types.ts                  # TypeScript definitions
├── styles.ts                 # Component styles
├── hooks/                    # Custom hooks
│   ├── index.ts              # Hooks exports
│   ├── usePressAndHold.ts    # Touch gesture handling
│   ├── useVoiceRecording.ts  # Voice recording logic
│   └── useVoiceInputI18n.ts  # Internationalization
├── components/               # Sub-components
│   ├── RecordingPanel/       # Recording interface
│   ├── AudioWaveform.tsx     # Audio visualization
│   └── TranscriptionDisplay.tsx # Text display
└── README.md                 # This documentation
```

## Internationalization

The component supports multiple languages through react-i18next:

### Supported Languages
- Chinese (zh_CN)
- English (en_US)

### Translation Keys

All text content is externalized to translation files located at:
- `src/opensource/assets/locales/zh_CN/component.json`
- `src/opensource/assets/locales/en_US/component.json`

**Translation structure:**
```json
{
  "voiceInput": {
    "button": {
      "pressToSpeak": "Press and hold to speak",
      "cancel": "Cancel",
      "convertToText": "Convert to text",
      "sendText": "Send text",
      "sendVoice": "Send original voice",
      "back": "Back"
    },
    "status": {
      "releaseToCancel": "Release to cancel sending",
      "releaseToSend": "Release to send"
    },
    "placeholder": {
      "textInput": "Type your message..."
    }
  }
}
```

### Using Custom Translations

You can override button text by passing the `buttonText` prop:

```tsx
<VoiceInput
  buttonText="Custom Button Text"
  onVoiceResult={handleVoiceResult}
  onTextResult={handleTextResult}
/>
```

If no `buttonText` is provided, the component will use the localized text based on the current language setting.

### Language Switching

The component automatically responds to language changes made through the i18n system. To change the language programmatically:

```tsx
import { useTranslation } from "react-i18next"

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  
  const switchToEnglish = () => {
    i18n.changeLanguage('en_US')
  }
  
  const switchToChinese = () => {
    i18n.changeLanguage('zh_CN')
  }
  
  return (
    <div>
      <button onClick={switchToEnglish}>English</button>
      <button onClick={switchToChinese}>中文</button>
    </div>
  )
}
```

## Props

```tsx
interface VoiceInputMobileProps {
  /** Voice recognition result callback */
  onVoiceResult?: (audioData: Blob) => void
  /** Text conversion result callback */
  onTextResult?: (text: string) => void
  /** Cancel recording callback */
  onCancel?: () => void
  /** Error callback */
  onError?: (error: Error) => void
  /** Status change callback */
  onStatusChange?: (status: VoiceInputStatus) => void
  /** Whether disabled */
  disabled?: boolean
  /** Custom button text (overrides i18n) */
  buttonText?: string
  /** Custom styles */
  style?: CSSProperties
  /** Custom class name */
  className?: string
  /** Custom button content */
  children?: ReactNode
}
```

## Usage Examples

### Basic Usage
```tsx
import VoiceInput from './components/VoiceInput'

<VoiceInput
  onVoiceResult={(audioBlob) => {
    // Handle voice recording
    console.log('Voice recorded:', audioBlob)
  }}
  onTextResult={(text) => {
    // Handle transcribed text
    console.log('Text result:', text)
  }}
  onError={(error) => {
    console.error('Voice input error:', error)
  }}
/>
```

### With Custom Styling
```tsx
<VoiceInput
  className="custom-voice-input"
  style={{ width: '100%', height: '50px' }}
  onVoiceResult={handleVoiceResult}
  onTextResult={handleTextResult}
/>
```

### Disabled State
```tsx
<VoiceInput
  disabled={!hasPermission}
  onVoiceResult={handleVoiceResult}
  onTextResult={handleTextResult}
/>
```

## Gestures

The component supports the following touch gestures:

1. **Press and Hold**: Start recording
2. **Slide Up**: Convert to text mode
3. **Slide Left**: Cancel recording
4. **Release**: Send voice message (default)

## Browser Support

- iOS Safari 14.0+
- Android Chrome 88+
- Modern mobile browsers with MediaRecorder API support

## Performance Considerations

- Uses `memo` for component optimization
- Implements proper cleanup for audio resources
- Debounced gesture recognition
- Efficient waveform rendering

## Development Notes

- Component uses modern React hooks patterns
- Full TypeScript support with strict types
- Comprehensive error handling
- Accessible design with proper ARIA labels
- Mobile-first responsive design
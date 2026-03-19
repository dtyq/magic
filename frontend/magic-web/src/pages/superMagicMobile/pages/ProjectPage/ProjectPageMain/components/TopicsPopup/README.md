# TopicsPopup Component

A mobile drawer component for displaying and managing topics in a project.

## Features

- Built with shadcn/ui Drawer component
- Styled with Tailwind CSS
- Displays list of all topics with status icons and mode tags
- Create new topic button in footer
- Responsive and mobile-optimized
- Internationalization support (zh_CN, en_US)

## Usage

```tsx
import { useState } from "react"
import TopicsPopup from "./components/TopicsPopup"

function YourComponent() {
  const [topicsPopupOpen, setTopicsPopupOpen] = useState(false)

  const handleCreateTopic = () => {
    // Your topic creation logic
    console.log("Create new topic")
  }

  return (
    <>
      <button onClick={() => setTopicsPopupOpen(true)}>
        Show Topics
      </button>

      <TopicsPopup
        open={topicsPopupOpen}
        onOpenChange={setTopicsPopupOpen}
        onCreateTopic={handleCreateTopic}
      />
    </>
  )
}
```

## Props

### TopicsPopup

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controls the drawer open state |
| `onOpenChange` | `(open: boolean) => void` | Callback when drawer state changes |
| `onCreateTopic` | `() => void` | Callback when create topic button is clicked |

## Components Structure

```
TopicsPopup/
├── index.tsx              # Main drawer component
├── components/
│   └── TopicItem/
│       ├── index.tsx      # Topic item component
│       └── components/
│           └── ModeTag/
│               └── index.tsx  # Mode tag component
└── README.md
```

## Design Reference

Figma Design: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=519-16307

## Internationalization Keys

- `super:topic.allTopics` - "全部话题" / "All Topics"
- `super:topic.createNewTopic` - "新建话题" / "New Topic"
- `super:topic.unnamedTopic` - "未命名话题" / "Unnamed topic"


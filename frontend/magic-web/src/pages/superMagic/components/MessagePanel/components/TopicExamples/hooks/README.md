# useTopicExamples Hook

A custom React hook for fetching and managing topic examples data with random selection capability.

## Features

- **Global Caching**: Fetches example data once and caches it globally for all hook instances
- **Mode-based Filtering**: Returns examples based on the current topic mode
- **Random Selection**: Randomly selects a specified number of examples
- **Smart Refresh**: Avoids showing the same examples consecutively when refreshing
- **Loading State**: Provides loading state during data fetching
- **Lazy Loading**: Only fetches data when enabled

## Usage

```typescript
import { useTopicExamples } from "./hooks/useTopicExamples"
import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"

function MyComponent() {
  const { exampleList, refreshExamples, rotationCount, loading } = useTopicExamples({
    topicMode: TopicMode.Translate,
    count: 5,
    enabled: true,
  })

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {exampleList.map((item) => (
        <div key={item.id}>{item.title.zh_CN}</div>
      ))}
      <button onClick={refreshExamples}>Refresh Examples</button>
    </div>
  )
}
```

## API

### Parameters

```typescript
interface UseTopicExamplesOptions {
  topicMode: TopicMode        // Current topic mode
  count?: number              // Number of examples to select (default: 5)
  enabled?: boolean           // Whether to fetch data (default: true)
}
```

### Return Value

```typescript
interface UseTopicExamplesReturn {
  exampleList: ExampleItem[]           // Currently selected examples
  refreshExamples: () => void          // Function to refresh examples
  rotationCount: number                // Current rotation count for animation
  loading: boolean                     // Loading state
  allExampleList: TopicExamplesList    // All fetched examples data
}
```

## Special Behaviors

### Chat and RecordSummary Modes
For `TopicMode.Chat` and `TopicMode.RecordSummary`, the hook returns an empty `exampleList` array.

### Smart Random Selection
When refreshing examples:
1. Attempts to select examples that haven't been shown yet
2. Falls back to all available examples if not enough unique ones exist
3. Randomizes the order of selected examples

### Global Data Cache
The example data is fetched once and cached globally:
- First hook instance triggers the fetch
- Subsequent instances reuse the cached data
- No duplicate network requests

## Example with Animation

```typescript
const { rotationCount, refreshExamples } = useTopicExamples({
  topicMode: TopicMode.Translate,
  count: 5,
})

return (
  <IconRefresh
    size={20}
    style={{
      transform: `rotate(${rotationCount * 360}deg)`,
      transition: "transform 0.5s ease-in-out",
    }}
    onClick={refreshExamples}
  />
)
```

## Testing

Unit tests are available in `__tests__/useTopicExamples.test.ts`.

Run tests with:
```bash
pnpm test hooks/__tests__/useTopicExamples.test.ts
```

# MagicInfiniteList

通用的无限滚动列表组件，支持自定义数据获取和项目渲染。

## 特性

- 🚀 支持无限滚动加载
- 🎨 自定义项目渲染
- 📡 自定义数据获取接口
- 🔄 内置加载状态管理
- ❌ 错误处理和重试
- 📱 移动端友好
- 🎯 TypeScript 支持

## 基本用法

```tsx
import MagicInfiniteList from "@/opensource/components/business/MagicInfiniteList"
import type { Friend } from "@/types/contact"

function FriendsList() {
  // 数据获取函数
  const fetchFriends = async (params: { page_token?: string } = {}) => {
    const response = await api.getFriends(params)
    return {
      items: response.data,
      has_more: response.has_more,
      page_token: response.page_token,
    }
  }

  // 项目渲染函数
  const renderFriend = (friend: Friend) => (
    <div onClick={() => handleFriendClick(friend)}>
      <Avatar src={friend.avatar} />
      <span>{friend.name}</span>
    </div>
  )

  return (
    <MagicInfiniteList<Friend>
      dataFetcher={fetchFriends}
      renderItem={renderFriend}
      getItemKey={(friend) => friend.id}
    />
  )
}
```

## 高级用法

### 自定义加载和空状态

```tsx
const customLoadingComponent = (
  <div className="loading">
    <Spin size="large" />
    <p>Loading more items...</p>
  </div>
)

const customEmptyComponent = (
  <div className="empty">
    <Empty description="No friends found" />
  </div>
)

<MagicInfiniteList
  dataFetcher={fetchFriends}
  renderItem={renderFriend}
  loadingComponent={customLoadingComponent}
  emptyComponent={customEmptyComponent}
/>
```

### 自定义 Item 样式

```tsx
// 使用自定义样式类
<MagicInfiniteList
  dataFetcher={fetchFriends}
  renderItem={renderFriend}
  itemClassName="custom-item-class"
  itemStyle={{ padding: '16px', margin: '8px' }}
/>

// 禁用默认样式，完全自定义
<MagicInfiniteList
  dataFetcher={fetchFriends}
  renderItem={renderFriend}
  useDefaultItemStyles={false}
  itemClassName="my-custom-item"
/>

// 组合默认样式和自定义样式
<MagicInfiniteList
  dataFetcher={fetchFriends}
  renderItem={renderFriend}
  useDefaultItemStyles={true}
  itemClassName="additional-styles"
/>
```

### 带参数的数据获取

```tsx
interface FetchParams {
  category: string
  keyword?: string
}

const fetchWithParams = async (params: FetchParams & { page_token?: string }) => {
  return await api.searchFriends({
    category: params.category,
    keyword: params.keyword,
    page_token: params.page_token,
  })
}

<MagicInfiniteList<Friend, FetchParams>
  dataFetcher={fetchWithParams}
  fetchParams={{ category: "work", keyword: "john" }}
  renderItem={renderFriend}
/>
```

## API 参考

### MagicInfiniteListProps

| 属性 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `dataFetcher` | `DataFetcher<T, P>` | ✅ | - | 数据获取函数 |
| `renderItem` | `RenderItem<T>` | ✅ | - | 项目渲染函数 |
| `fetchParams` | `P` | ❌ | - | 额外的获取参数 |
| `loadingComponent` | `ReactNode` | ❌ | 默认加载组件 | 自定义加载组件 |
| `emptyComponent` | `ReactNode` | ❌ | 默认空状态组件 | 自定义空状态组件 |
| `className` | `string` | ❌ | - | 容器样式类名 |
| `style` | `CSSProperties` | ❌ | - | 容器内联样式 |
| `itemClassName` | `string` | ❌ | - | 列表项样式类名 |
| `itemStyle` | `CSSProperties` | ❌ | - | 列表项内联样式 |
| `useDefaultItemStyles` | `boolean` | ❌ | `true` | 是否使用默认项目样式 |
| `scrollableTarget` | `string` | ❌ | 自动生成 | 滚动容器ID |
| `autoFetch` | `boolean` | ❌ | `true` | 是否自动获取数据 |
| `getItemKey` | `(item: T, index: number) => string \| number` | ❌ | index | 项目唯一键提取器 |

### DataFetcher

```typescript
type DataFetcher<T = any, P = any> = (
  params?: P & { page_token?: string }
) => Promise<PaginationResponse<T>>
```

### PaginationResponse

```typescript
interface PaginationResponse<T = any> {
  items: T[]
  has_more: boolean
  page_token: string
}
```

## 配套 Hook

### useInfiniteData

如果你需要更细粒度的控制，可以直接使用 `useInfiniteData` hook：

```tsx
import { useInfiniteData } from "@/opensource/components/business/MagicInfiniteList"

function CustomList() {
  const { data, isLoading, error, fetchData, refresh } = useInfiniteData(
    fetchFriends,
    {
      autoFetch: true,
      initialParams: { category: "work" },
      keyExtractor: (friend) => friend.id,
    }
  )

  if (error) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div>
      {data?.items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
      {isLoading && <div>Loading...</div>}
      <button onClick={() => fetchData({ page_token: data?.page_token })}>
        Load More
      </button>
    </div>
  )
}
```

## 样式自定义

组件使用 `antd-style` 进行样式管理，你可以通过 `className` 和 `style` 属性进行自定义：

```tsx
<MagicInfiniteList
  className="my-custom-list"
  style={{ height: '400px' }}
  // ... other props
/>
```

## 最佳实践

1. **键提取器**: 总是提供 `getItemKey` 以提高列表性能
2. **错误处理**: 在 `dataFetcher` 中处理错误，组件会自动显示错误状态
3. **内存优化**: 对于大量数据，考虑使用虚拟滚动
4. **用户体验**: 提供有意义的加载和空状态组件

## 迁移指南

从原有的 `useAiAssistantData` + 手动列表渲染迁移：

### 之前

```tsx
const { data, isLoading, trigger } = useAiAssistantData()

return (
  <InfiniteScroll
    dataLength={data?.items?.length || 0}
    next={() => trigger({ page_token: data?.page_token })}
    hasMore={data?.has_more}
    // ... more props
  >
    <List
      dataSource={data?.items}
      renderItem={(item) => <FriendItem item={item} />}
    />
  </InfiniteScroll>
)
```

### 之后

```tsx
const { fetchAiAssistantData } = useAiAssistantData()

return (
  <MagicInfiniteList<Friend>
    dataFetcher={fetchAiAssistantData}
    renderItem={(friend) => <FriendItem item={friend} />}
    getItemKey={(friend) => friend.friend_id}
  />
)
``` 
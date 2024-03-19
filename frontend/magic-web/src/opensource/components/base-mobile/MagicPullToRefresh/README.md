# MagicPullToRefresh 组件

移动端下拉刷新组件，基于 Ant Design Mobile 的 PullToRefresh 封装。

## 特性

- ✅ 开箱即用的下拉刷新功能
- ✅ 自动处理成功/失败提示
- ✅ 支持自定义容器高度和样式
- ✅ 完整的 TypeScript 类型支持
- ✅ 支持所有 antd-mobile PullToRefresh 的原生属性
- ✅ iOS 和 Android 原生体验优化
- ✅ 国际化支持

## 基础用法

```tsx
import MagicPullToRefresh from "@/opensource/components/base-mobile/MagicPullToRefresh"

function MyComponent() {
  const handleRefresh = async () => {
    await fetchData()
  }

  return (
    <MagicPullToRefresh onRefresh={handleRefresh}>
      <div>您的内容</div>
    </MagicPullToRefresh>
  )
}
```

## API

### Props

| 参数 | 说明 | 类型 | 默认值 | 必填 |
|------|------|------|--------|------|
| onRefresh | 刷新回调函数 | `() => Promise<void>` | - | ✅ |
| children | 子元素内容 | `ReactNode` | - | ✅ |
| height | 容器高度 | `number \| string` | `"100%"` | ❌ |
| containerStyle | 容器样式 | `CSSProperties` | - | ❌ |
| containerClassName | 容器类名 | `string` | - | ❌ |
| successText | 刷新成功提示文案 | `string` | `t("common.refreshSuccess")` | ❌ |
| showSuccessMessage | 是否显示刷新成功提示 | `boolean` | `true` | ❌ |
| onRefreshSuccess | 刷新成功回调 | `() => void` | - | ❌ |
| onRefreshError | 刷新失败回调 | `(error: Error) => void` | - | ❌ |

### 继承 Ant Design Mobile PullToRefresh 的所有属性

| 参数 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| pullingText | 下拉时的提示文案 | `ReactNode` | `"下拉刷新"` |
| canReleaseText | 释放时的提示文案 | `ReactNode` | `"释放立即刷新"` |
| refreshingText | 刷新时的提示文案 | `ReactNode` | `"加载中..."` |
| completeText | 完成时的提示文案 | `ReactNode` | `"刷新成功"` |
| completeDelay | 完成后延迟消失时间 (ms) | `number` | `500` |
| headHeight | 头部提示内容区的高度 | `number` | `40` |
| threshold | 触发刷新需要的最少位移 | `number` | `60` |
| disabled | 是否禁用下拉刷新 | `boolean` | `false` |
| renderText | 自定义渲染提示文案 | `(status: PullStatus) => ReactNode` | - |

## 使用示例

### 1. 基础用法

```tsx
<MagicPullToRefresh onRefresh={async () => await fetchData()}>
  <List data={data} />
</MagicPullToRefresh>
```

### 2. 自定义高度

```tsx
<MagicPullToRefresh 
  onRefresh={handleRefresh}
  height={600}  // 或 height="80vh"
>
  <Content />
</MagicPullToRefresh>
```

### 3. 自定义成功提示

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  successText="数据已更新"
>
  <Content />
</MagicPullToRefresh>
```

### 4. 禁用成功提示

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  showSuccessMessage={false}
>
  <Content />
</MagicPullToRefresh>
```

### 5. 监听刷新状态

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  onRefreshSuccess={() => {
    console.log("刷新成功")
  }}
  onRefreshError={(error) => {
    console.error("刷新失败:", error)
  }}
>
  <Content />
</MagicPullToRefresh>
```

### 6. 自定义提示文案

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  pullingText="拉啊拉"
  canReleaseText="松开更新"
  refreshingText="努力加载中..."
  completeText="更新完成"
>
  <Content />
</MagicPullToRefresh>
```

### 7. 自定义样式

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  containerStyle={{ 
    background: "#f5f5f5",
    borderRadius: "8px"
  }}
  containerClassName="my-custom-class"
>
  <Content />
</MagicPullToRefresh>
```

### 8. 禁用下拉刷新

```tsx
<MagicPullToRefresh
  onRefresh={handleRefresh}
  disabled={true}  // 使用 antd-mobile 原生的 disabled 属性
>
  <Content />
</MagicPullToRefresh>
```

### 9. 完整示例

```tsx
import { useState } from "react"
import MagicPullToRefresh from "@/opensource/components/base-mobile/MagicPullToRefresh"

function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await api.getProjects()
      setProjects(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <MagicPullToRefresh
      onRefresh={fetchProjects}
      height="calc(100vh - 60px)"
      successText="项目列表已更新"
      onRefreshSuccess={() => {
        // 刷新成功后的额外操作
        analytics.track("projects_refreshed")
      }}
      onRefreshError={(error) => {
        // 错误处理
        console.error(error)
      }}
    >
      {loading ? (
        <Loading />
      ) : (
        <div>
          {projects.map(project => (
            <ProjectItem key={project.id} {...project} />
          ))}
        </div>
      )}
    </MagicPullToRefresh>
  )
}
```

## 注意事项

### 1. 容器高度

组件需要明确的高度才能正常工作。如果父容器没有设置高度，请通过 `height` 属性指定：

```tsx
// ✅ 正确
<MagicPullToRefresh height={600}>
  <Content />
</MagicPullToRefresh>

// ❌ 错误：父容器没有高度
<div> {/* 没有设置高度 */}
  <MagicPullToRefresh>
    <Content />
  </MagicPullToRefresh>
</div>
```

### 2. 异步操作

`onRefresh` 必须返回 Promise，组件会等待 Promise 完成后才结束刷新状态：

```tsx
// ✅ 正确
<MagicPullToRefresh
  onRefresh={async () => {
    await fetchData()
  }}
>

// ❌ 错误：没有返回 Promise
<MagicPullToRefresh
  onRefresh={() => {
    fetchData() // 忘记 await
  }}
>
```

### 3. iOS 橡皮筋效果

组件已优化 iOS 的原生滚动体验，包括：
- `-webkit-overflow-scrolling: touch`
- 橡皮筋回弹效果
- 流畅的触摸反馈

### 4. 性能优化

- 自动隐藏滚动条
- 优化触摸事件处理
- 支持大列表滚动

## 与其他方案对比

相比原生 antd-mobile PullToRefresh：

| 特性 | MagicPullToRefresh | 原生 PullToRefresh |
|------|-------------------|-------------------|
| 容器管理 | ✅ 自动管理 | ❌ 需手动设置 |
| 成功提示 | ✅ 自动显示 | ❌ 需手动处理 |
| 错误处理 | ✅ 自动捕获 | ❌ 需手动处理 |
| TypeScript | ✅ 完整类型 | ✅ 完整类型 |
| 样式定制 | ✅ 更灵活 | ⚠️ 受限 |
| 回调钩子 | ✅ 丰富 | ⚠️ 基础 |

## 技术细节

### 依赖

- `antd-mobile`: ^5.39.0
- `antd`: ^5.28.0
- `antd-style`: ^3.6.2
- `react-i18next`: ^14.1.1

### 兼容性

- iOS 12+
- Android 5+
- 现代浏览器

## 常见问题

### Q: 为什么下拉没有反应？

A: 检查以下几点：
1. 容器是否有明确的高度
2. 内容是否足够长可以滚动
3. 是否设置了 `enableScroll={false}`

### Q: 如何禁用下拉刷新？

A: 使用 antd-mobile 原生的 `disabled` 属性：

```tsx
<MagicPullToRefresh onRefresh={handleRefresh} disabled={true}>
  <Content />
</MagicPullToRefresh>
```

### Q: 如何自定义刷新指示器？

A: 使用 `renderText` 属性：

```tsx
<MagicPullToRefresh
  renderText={(status) => {
    return <CustomIndicator status={status} />
  }}
>
```

## 更新日志

### v1.0.0 (2024-12-10)

- ✨ 初始版本发布
- ✅ 基于 Ant Design Mobile 封装
- ✅ 支持自定义高度和样式
- ✅ 自动处理成功/失败提示
- ✅ 完整的 TypeScript 类型支持

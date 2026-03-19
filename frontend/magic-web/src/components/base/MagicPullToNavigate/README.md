# MagicPullToNavigate

一个支持下拉导航的 React 组件，集成了 MagicLoading 来显示滑动进度。

## 🎯 功能特性

- ✨ 下拉触发导航功能
- 📊 实时显示滑动进度（0-100%）
- 🎮 MagicLoading 动画集成
- 📱 移动端友好的触摸交互
- 🎨 可自定义的动画和文本
- 🔧 灵活的配置选项
- 🎭 自定义动画内容支持
- 📞 生命周期回调函数
- 🔄 智能滚动冲突检测，避免干扰子元素滚动

## 🚀 基础使用

```tsx
import MagicPullToNavigate from './MagicPullToNavigate'

function App() {
  const handleNavigate = async () => {
    // 处理导航逻辑
    console.log('Navigation triggered!')
  }

  const handlePullStart = () => {
    console.log('Pull started')
    // Track analytics, show feedback, etc.
  }

  const handlePullEnd = (success: boolean) => {
    console.log(`Pull ended - ${success ? 'Navigation triggered' : 'Navigation cancelled'}`)
    // Clean up, hide feedback, etc.
  }

  return (
    <MagicPullToNavigate
      onNavigate={handleNavigate}
      onStart={handlePullStart}
      onEnd={handlePullEnd}
    >
      <div>
        {/* 你的页面内容 */}
      </div>
    </MagicPullToNavigate>
  )
}
```

## 📊 进度显示功能

组件默认使用 `MagicLoading` 来显示滑动进度：

- **实时进度**：滑动距离 0-100% 直接映射到动画帧
- **视觉反馈**：保持 MagicLoading 原始颜色
- **平滑动画**：结合 framer-motion 实现流畅效果

## ⚙️ 配置选项

### 基础配置

```tsx
<MagicPullToNavigate
  onNavigate={handleNavigate}
  onStart={handlePullStart}
  onEnd={handlePullEnd}
  threshold={80}                    // 触发阈值（默认 80）
  maxDistance={200}                 // 最大拉动距离（默认 200）
  disabled={false}                  // 是否禁用（默认 false）
  resistance={0.8}                  // 阻力系数（默认 0.8）
  respectScrollableChildren={true}  // 是否尊重可滚动子元素（默认 false）
>
  {children}
</MagicPullToNavigate>
```

### 自定义文本

```tsx
<MagicPullToNavigate
  texts={{
    pullDown: "下拉查看进度",
    releaseToNavigate: "松开触发导航",
    navigating: "正在导航中...",
  }}
  onStart={handlePullStart}
  onEnd={handlePullEnd}
>
  {children}
</MagicPullToNavigate>
```

### 自定义内容

```tsx
<MagicPullToNavigate
  customContent={{
    // 自定义图标
    icon: MyCustomIcon,
    
    // 完全自定义渲染
    render: ({ pullDistance, isRefreshing, currentText }) => (
      <div>
        <span>进度: {pullDistance}%</span>
        <span>{currentText}</span>
      </div>
    ),
    
    // 样式配置
    showDefaultBackground: false,
    containerStyle: { background: 'transparent' },
  }}
  onStart={handlePullStart}
  onEnd={handlePullEnd}
>
  {children}
</MagicPullToNavigate>
```

## 🎨 MagicLoading 集成

### 默认行为

- **拉动时**：显示 MagicLoading 进度动画
- **导航时**：显示自动播放的 MagicLoading 动画
- **样式**：保持原始颜色 + 缩放动画

### 技术实现

```tsx
// pullDistance (0-100) 映射到动画帧
<MagicLoading
  currentFrame={pullDistance}
  autoplay={false}
/>
```

## 📱 移动端优化

- **触摸事件**：支持 touch 事件
- **性能优化**：使用 `will-change` 和 GPU 加速
- **滚动处理**：智能检测滚动状态
- **阻力感**：模拟真实的物理阻力

## 🔄 滚动冲突解决

### 问题描述
在包含可滚动列表的页面中，下拉导航可能会干扰列表的正常滚动行为。

### 解决方案
启用 `respectScrollableChildren` 选项，组件会智能检测：

1. **触摸目标检测**：识别用户触摸的是否为可滚动元素
2. **滚动状态判断**：检查可滚动元素是否还有向上滚动的空间
3. **智能让步**：如果可滚动元素可以继续滚动，则不激活下拉导航

### 使用示例

```tsx
// 适用于包含聊天列表、消息列表等可滚动内容的页面
<MagicPullToNavigate
  respectScrollableChildren={true}  // 启用智能滚动检测
  onNavigate={handleNavigate}
>
  <div className="chat-container">
    <div className="chat-list" style={{ overflowY: 'auto' }}>
      {/* 聊天消息列表 - 可以正常滚动 */}
      {messages.map(message => <ChatItem key={message.id} {...message} />)}
    </div>
  </div>
</MagicPullToNavigate>
```

### 工作原理

1. **触摸开始**：记录触摸目标元素
2. **移动检测**：检查触摸目标及其父元素是否可滚动
3. **滚动判断**：如果找到可滚动元素且 `scrollTop > 0`，则不干扰
4. **导航激活**：只有当所有可滚动元素都在顶部时，才激活下拉导航

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `respectScrollableChildren` | `boolean` | `false` | 是否启用智能滚动检测 |

**注意**：为了保持向后兼容性，此功能默认关闭。建议在包含可滚动内容的页面中启用。

## 🎯 使用场景

- **页面导航**：下拉返回上一页
- **刷新功能**：下拉刷新页面内容
- **模式切换**：下拉切换应用模式
- **快捷操作**：下拉触发特定功能

## 📝 完整示例

查看 `examples/LoadingProgressExample.tsx` 获取完整的使用示例。

## 🔧 API 参考

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `children` | `ReactNode` | - | 页面内容 |
| `onNavigate` | `() => Promise<void> \| void` | - | 导航回调函数 |
| `onStart` | `() => void` | - | 拉动开始回调函数 |
| `onEnd` | `(success: boolean) => void` | - | 拉动结束回调函数，接收成功状态参数 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `threshold` | `number` | `80` | 触发阈值 |
| `maxDistance` | `number` | `200` | 最大拉动距离 |
| `resistance` | `number` | `0.8` | 阻力系数 |
| `respectScrollableChildren` | `boolean` | `false` | 是否尊重可滚动子元素 |
| `texts` | `object` | - | 自定义文本 |
| `customContent` | `object` | - | 自定义内容配置 |
| `className` | `string` | - | 自定义类名 |
| `style` | `CSSProperties` | - | 自定义样式 |

### 事件

- **onNavigate**: 当用户完成下拉操作时触发
- **内部事件**: 自动处理 touch 和 scroll 事件

## 🎨 样式定制

组件使用 `antd-style` 进行样式管理，支持主题定制：

```tsx
const useCustomStyles = createStyles(({ css, token }) => ({
  container: css`
    background: ${token.colorPrimary};
  `,
}))
```

## 工作原理

1. **触摸检测**: 组件监听 `touchstart`、`touchmove`、`touchend` 事件
2. **条件判断**: 只有在页面顶部（scrollTop = 0）且向下拉动时才激活
3. **跟随移动**: 内容区域通过 `transform: translateY()` 跟随手指移动
4. **显示 UI**: 在拉动产生的空白区域显示自定义动画内容（居中显示）
5. **阈值判断**: 松手时检查是否达到阈值，决定是否触发导航
6. **退场动画**: 如果触发导航，界面会从当前位置滑动到 100vh 高度
7. **状态重置**: 动画完成后平滑恢复到初始状态

## 自定义样式示例

```tsx
<MagicPullToNavigate
  customContent={{
    render: ({ isActive, pullDistance, isRefreshing, currentText }) => (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px'
      }}>
        <div style={{ 
          transform: `scale(${1 + pullDistance / 200})`,
          marginBottom: '8px'
        }}>
          🚀
        </div>
        <p>{currentText}</p>
      </div>
    )
  }}
  onStart={handlePullStart}
  onEnd={handlePullEnd}
>
  {/* 内容 */}
</MagicPullToNavigate>
```

## 注意事项

- 组件主要为移动端设计，在桌面端可能需要额外的鼠标事件支持
- 确保容器有足够的高度（建议 100vh）
- 在 iOS Safari 中可能需要额外的 CSS 处理来避免橡皮筋效果
- 建议在真实设备上测试触摸交互效果

## 浏览器兼容性

- iOS Safari 10+
- Android Chrome 60+
- 现代移动浏览器 
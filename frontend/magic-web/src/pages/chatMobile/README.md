# ChatMobile 组件

移动端聊天页面组件，集成了下拉导航到AI助理市场的功能。

## 功能特性

- 📱 移动端优化的聊天界面
- 🎯 下拉导航到AI助理市场
- 💬 聊天列表和AI助手列表切换
- 📌 置顶消息管理
- 🔄 流畅的动画过渡

## 下拉导航功能

该组件集成了 `MagicPullToNavigate` 组件，用户可以通过下拉手势快速进入AI助理市场。

### 使用方式

1. **下拉操作**: 在聊天列表顶部向下拉动
2. **视觉反馈**: 显示"下拉刷新，继续下拉进入 AI助理市场"
3. **达到阈值**: 显示"松开进入 AI助理市场"
4. **释放导航**: 松开手指后自动导航到探索页面

### 配置参数

```tsx
<MagicPullToNavigate
  onNavigate={handleNavigateToAIMarket}
  texts={{
    pullDown: "下拉刷新，继续下拉进入 AI助理市场",
    releaseToNavigate: "松开进入 AI助理市场",
    navigating: "正在进入 AI助理市场...",
  }}
  threshold={80}
  resistance={0.5}
  className={styles.container}
>
  {/* 整个聊天页面内容 */}
  <UserHeader />
  <MessageTypeSegmented />
  <PinnedMessages />
  <ChatContent />
  <ConversationMenu />
</MagicPullToNavigate>
```

### 导航处理

```tsx
const handleNavigateToAIMarket = async () => {
  try {
    // 添加延迟以提供更好的用户体验
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    // 导航到探索页面（AI助理市场）
    navigate(RoutePath.Explore)
    
    console.log("Successfully navigated to AI assistant market")
  } catch (error) {
    console.error("Failed to navigate to AI market:", error)
  }
}
```

## 组件结构

```
ChatMobile/
└── MagicPullToNavigate # 下拉导航包装器（包裹整个页面）
    ├── UserHeader          # 用户头部信息
    ├── MessageTypeSegmented  # 消息类型切换
    ├── PinnedMessages       # 置顶消息
    ├── ChatContent          # 聊天内容列表
    └── ConversationMenu    # 对话菜单
```

## 样式注意事项

- `MagicPullToNavigate` 组件直接使用原有的 `styles.container` 样式类
- 包裹整个页面内容，确保下拉手势在任何位置都能触发
- 保持原有的布局结构和样式不变
- 下拉动画不会影响现有的滚动行为

## 使用场景

- **快速访问**: 用户可以快速从聊天列表进入AI助理市场
- **发现新功能**: 引导用户探索更多AI助手
- **提升体验**: 提供直观的手势操作

## 技术实现

- 使用 `MagicPullToNavigate` 组件包装整个页面内容
- 通过 `useNavigate` Hook 实现页面导航
- 集成现有的路由系统（`RoutePath.Explore`）
- 继承原有容器样式，保持设计一致性
- 保持组件的响应式设计和性能优化

## 实现优势

- **全页面覆盖**: 下拉手势在页面任何位置都能触发
- **无缝集成**: 不改变原有的组件结构和样式
- **用户体验**: 提供直观的导航方式到AI助理市场
- **性能优化**: 只在需要时触发导航，避免不必要的操作 
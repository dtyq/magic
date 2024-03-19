# TopicModeTabs 组件

主题模式标签组件，用于在桌面端和移动端显示不同的 AI 模式选择界面。

## 文件结构

```
TopicModeTabs/
├── index.tsx                    # 主入口，根据设备类型路由到不同组件
├── TopicModeTabs.desktop.tsx   # 桌面端实现
├── TopicModeTabs.mobile.tsx    # 移动端实现
├── types.ts                     # TypeScript 类型定义
├── icons/                       # 图标组件
└── components/
    └── TopicModeTab/           # Tab 子组件
        ├── index.tsx
        ├── TopicModeTab.desktop.tsx
        └── TopicModeTab.mobile.tsx
```

## 组件说明

### 主入口 (index.tsx)

- 使用 `useIsMobile()` hook 检测设备类型
- 根据 `isMobile` 条件渲染对应的组件
- 处理共享的业务逻辑（模式列表过滤、默认模式设置等）

### 桌面端组件 (TopicModeTabs.desktop.tsx)

**布局特点：**
- 垂直布局，最小高度 100px
- 只显示前 6 个常用模式
- 包含分隔线和"更多代理"按钮
- 使用 CVA 管理样式变体

**样式：**
```tsx
className="mb-2.5 flex min-h-[100px] flex-nowrap items-stretch justify-center gap-6"
```

### 移动端组件 (TopicModeTabs.mobile.tsx)

**布局特点：**
- 横向滚动布局，高度 36px
- 显示所有常用模式
- "更多代理"按钮作为最后一项
- 使用 `scrollbar-y-thin ` 提供更好的滚动体验

**样式：**
```tsx
className="scrollbar-y-thin  mb-3 flex min-h-[36px] items-center gap-1.5 overflow-x-auto"
```

**设计规范（来自 Figma）：**
- 高度：36px
- 间距：6px (gap-1.5)
- 内边距：8px 14px 8px 8px
- 圆角：rounded-full
- 边框：border-border

## 使用示例

```tsx
import TopicModeTabs from './components/TopicModeTabs'

function MessagePanel() {
  const [activeMode, setActiveMode] = useState('general')

  return (
    <TopicModeTabs
      activeMode={activeMode}
      onModeChange={setActiveMode}
    />
  )
}
```

## Props

| 属性 | 类型 | 说明 |
|------|------|------|
| activeMode | string | 当前激活的模式标识符 |
| onModeChange | (mode: TopicMode) => void | 模式切换回调函数 |

## 技术栈

- **样式系统**: Tailwind CSS + class-variance-authority (CVA)
- **响应式检测**: `useIsMobile()` hook
- **状态管理**: React hooks
- **懒加载**: `lazy()` + `Suspense` for AgentDesigner

## 设计原则

1. **关注点分离**: 桌面端和移动端完全独立，便于维护
2. **样式一致性**: 使用 CVA 管理样式变体
3. **性能优化**: 懒加载 AgentDesigner 组件
4. **响应式设计**: 根据设备类型动态渲染
5. **用户体验**: 移动端支持横向滚动，桌面端固定布局

## 相关文档

- [Figma 设计稿](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=969-34027)
- [Tailwind CSS 使用规范](/.cursor/rules/shadcn-tailwind-guide.mdc)
- [CVA 使用指南](https://cva.style/docs)


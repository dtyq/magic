# ExplorePageMobile 移动端探索页面

基于 Figma 设计实现的移动端精选助理页面，展示 AI 助理卡片列表。

## 功能特性

- 📱 **移动端优化**: 专为移动设备设计的响应式布局
- 🎨 **Figma 设计还原**: 完美还原设计稿的视觉效果
- 🔄 **水平滚动**: 支持左右滑动浏览更多助理
- 🎯 **交互友好**: 流畅的点击反馈和动画效果
- 🌈 **主题适配**: 自动适应亮色/暗色主题

## 组件结构

```
exploreMobile/
├── index.tsx              # 主页面组件
├── types.ts              # TypeScript 类型定义
├── components/
│   ├── SectionHeader/    # 页面标题组件
│   │   └── index.tsx
│   └── AssistantCard/    # 助理卡片组件
│       └── index.tsx
└── README.md            # 说明文档
```

## 设计规范

### 布局尺寸
- 容器内边距: `12px 14px`
- 组件间距: `18px`
- 卡片间距: `14px`
- 列间距: `20px`

### 字体规范
- 标题: PingFang SC, 14px, 600
- 副标题: PingFang SC, 12px, 400
- 卡片标题: PingFang SC, 12px, 600
- 卡片描述: PingFang SC, 10px, 400

### 颜色规范
- 主要文本: `token.magicColorUsages.text[0]`
- 次要文本: `token.magicColorUsages.text[2]`
- 链接颜色: `#315CEC`
- 背景色: `token.magicColorUsages.bg[0]`

## 使用方法

```tsx
import ExplorePageMobile from '@/opensource/pages/exploreMobile'

// 在路由中使用
<Route path="/explore-mobile" component={ExplorePageMobile} />
```

## 数据结构

```typescript
interface AssistantData {
  id: string              // 助理唯一标识
  name: string           // 助理名称
  description: string    // 助理描述
  icon: string          // 助理图标 URL
  backgroundColor: string // 图标背景色
}
```

## 交互行为

1. **查看全部**: 点击右上角"查看全部"按钮跳转到完整列表
2. **助理卡片**: 点击任意助理卡片进入对话或详情页
3. **水平滚动**: 左右滑动查看更多助理选项

## 技术实现

- **React**: 使用函数组件和 Hooks
- **MobX**: 状态管理和响应式更新
- **antd-style**: CSS-in-JS 样式解决方案
- **TypeScript**: 完整的类型安全保障

## 性能优化

- 使用 `memo` 避免不必要的重渲染
- 图片资源预加载和优化
- 滚动性能优化（隐藏滚动条）
- 组件懒加载支持

## 扩展性

组件设计具有良好的扩展性：

1. **数据源**: 可轻松替换为 API 数据
2. **样式定制**: 支持主题变量覆盖
3. **交互增强**: 可添加更多手势操作
4. **国际化**: 支持多语言文本替换 
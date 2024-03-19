# 智能骨架屏生成器使用指南

## 概述

本项目实现了一套完整的骨架屏解决方案：
- **FallbackManager**：统一管理路由的骨架屏（移动端/PC端）
- **智能 SVG 生成器**：自动分析页面 DOM 结构，生成高质量 SVG
- **可视化调整**：配合 react-content-loader 在线编辑器

## 快速开始

### 步骤1：启动开发服务器

```bash
pnpm dev
```

### 步骤2：访问目标页面

访问需要创建骨架屏的页面（例如：TopicPage）

### 步骤3：运行生成器

打开浏览器 DevTools 控制台，运行：

```javascript
// 基础使用
window.generateSkeletonSVG('.topic-page-container')

// 带参数
window.generateSkeletonSVG('.topic-page-container', {
  simplify: true,  // 简化结构（默认 true）
  minSize: 20,     // 最小元素尺寸（默认 20px）
  baseY: 0         // 起始 Y 坐标（默认 0）
})
```

**注意**：将 `.topic-page-container` 替换为实际的容器选择器

### 步骤4：导入在线编辑器

1. SVG 代码会自动复制到剪贴板
2. 访问 [https://skeletonreact.com/](https://skeletonreact.com/)
3. 点击编辑器右侧的 **"Import"** 按钮
4. 粘贴 SVG 代码（Ctrl/Cmd + V）

### 步骤5：可视化调整

在线编辑器中：
- 🖱️ 拖拽元素调整位置
- 📏 调整宽度和高度
- 🎨 修改圆角、间距
- ➕ 添加/删除元素
- 👁️ 实时预览效果

### 步骤6：导出代码

1. 调整满意后，点击 **"Copy code"** 按钮
2. 将代码粘贴到对应的骨架屏文件

## 为新路由添加骨架屏

### 1. 创建骨架屏组件

在页面目录下创建 `SkeletonMobile.tsx`：

```typescript
import ContentLoader from "react-content-loader"

export default function PageSkeletonMobile() {
  return (
    <ContentLoader>
      {/* 从在线编辑器导出的代码 */}
    </ContentLoader>
  )
}
```

### 2. 注册到 FallbackManager

在 `src/routes/FallbackManager.tsx` 中：

```typescript
import PageSkeletonMobile from "@/path/to/SkeletonMobile"

// 注册
FallbackManager.register(RouteName.YourPage, {
  mobile: <PageSkeletonMobile />,
  desktop: <PageSkeletonDesktop />, // 可选
})
```

### 3. 在路由配置中使用

在 `src/routes/routes.tsx` 中：

```typescript
{
  name: RouteName.YourPage,
  path: RoutePath.YourPage,
  element: FallbackManager.wrap(<YourPage />, RouteName.YourPage),
}
```

## 智能识别规则

生成器会自动识别：

- **头像**：圆形元素、`img` 标签、包含 `avatar/circle/round` 的 className
- **按钮**：`button` 标签、包含 `button` 的 className
- **输入框**：`input/textarea` 标签、`contenteditable` 属性
- **文本**：叶子节点的文本内容
- **容器**：`flex/grid` 布局容器

## 配置选项

### simplify（简化结构）

```javascript
// 简化模式（推荐）
window.generateSkeletonSVG('.container', { simplify: true })
// 跳过纯容器，减少嵌套

// 完整模式
window.generateSkeletonSVG('.container', { simplify: false })
// 保留所有容器
```

### minSize（最小尺寸）

```javascript
// 默认 20px
window.generateSkeletonSVG('.container', { minSize: 20 })

// 过滤更小的元素
window.generateSkeletonSVG('.container', { minSize: 30 })
```

### baseY（起始坐标）

```javascript
// 从顶部开始（默认）
window.generateSkeletonSVG('.container', { baseY: 0 })

// 如果需要偏移
window.generateSkeletonSVG('.container', { baseY: 20 })
```

## 常见问题

### Q: 生成的 SVG 太复杂？

**A**: 使用 `simplify: true` 选项，或增加 `minSize` 值：

```javascript
window.generateSkeletonSVG('.container', { 
  simplify: true, 
  minSize: 30 
})
```

### Q: 无法找到目标元素？

**A**: 检查选择器是否正确，确保页面已完全加载：

```javascript
// 在控制台验证选择器
document.querySelector('.your-selector')
```

### Q: SVG 代码没有复制到剪贴板？

**A**: 手动复制控制台输出的 SVG 代码

### Q: 在线编辑器无法导入 SVG？

**A**: 检查 SVG 格式是否正确，或尝试简化 SVG 结构

## 最佳实践

1. **页面完全加载后再生成**：确保数据已加载，元素已渲染
2. **选择合适的容器**：选择包含主要内容的容器，避免包含导航栏等
3. **使用简化模式**：减少不必要的嵌套
4. **在线调整优化**：自动生成只是初稿，在线调整可以大幅提升质量
5. **保持简洁**：骨架屏不需要完全还原页面，重点突出布局结构

## 示例

### 移动端 TopicPage

```javascript
// 1. 访问 TopicPage
// 2. 运行生成器
window.generateSkeletonSVG('.topic-page-container')

// 3. 导入 https://skeletonreact.com/
// 4. 调整后复制代码到 SkeletonMobile.tsx
```

## 技术细节

- **生成器位置**：`src/utils/dev/skeletonGenerator.ts`
- **自动加载**：仅在开发环境加载（`import.meta.env.DEV`）
- **类型定义**：生成的 SVG 符合 react-content-loader 标准格式
- **性能**：客户端运行，不影响构建性能

## 相关链接

- [react-content-loader 官网](https://skeletonreact.com/)
- [react-content-loader GitHub](https://github.com/danilowoz/react-content-loader)
- [FallbackManager 源码](./src/routes/FallbackManager.tsx)


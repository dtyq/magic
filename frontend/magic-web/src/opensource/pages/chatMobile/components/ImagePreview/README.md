# 移动端图片预览组件 (ImagePreview)

## 功能特性

### 🔍 手势交互
- **双击缩放**: 双击图片可以在 1x 和 2x 之间切换缩放
- **双指缩放**: 使用双指进行自由缩放 (1x - 4x)
- **拖拽移动**: 在放大状态下可以拖拽查看不同区域
- **下滑关闭**: 在原始大小(1x)时，向下滑动可以关闭图片预览
- **边界约束**: 自动约束拖拽和缩放的边界，防止图片移出可视区域

### 🖼️ 图片支持
- **多格式支持**: 支持常见图片格式 (JPG, PNG, WebP, GIF等)
- **SVG增强**: 特殊处理SVG格式，提供更好的显示效果
- **高清转换**: 支持高清图片的加载和转换进度显示

### 📱 移动端优化
- **触摸优化**: 专为移动端触摸操作优化
- **性能优化**: 使用 `transform3d` 和 `will-change` 优化动画性能
- **响应式**: 自适应不同屏幕尺寸

## 交互说明

### 基础操作
- **关闭**: 点击右上角 ❌ 按钮或使用返回手势
- **查看**: 图片默认以适合屏幕的大小显示

### 缩放操作
- **双击缩放**: 
  - 双击图片中心 → 放大到 2x
  - 双击放大后的图片 → 缩小到 1x
  - 双击非中心位置 → 以点击点为中心放大

- **双指缩放**:
  - 两指向外拉伸 → 放大图片 (最大 4x)
  - 两指向内收缩 → 缩小图片 (最小 1x)
  - 以双指中心点为缩放中心

### 拖拽操作
- **条件**: 仅在图片放大状态 (scale > 1) 时可以拖拽
- **方向**: 支持水平和垂直方向拖拽
- **边界**: 自动约束在图片边界内，不会拖拽到空白区域

### 下滑关闭
- **触发条件**: 仅在图片处于原始大小 (scale = 1) 时生效
- **方向检测**: 智能识别垂直和水平滑动方向
- **视觉反馈**: 下滑时图片跟随手指移动，背景透明度实时变化
- **阈值**: 下滑距离超过 150px 时触发关闭
- **回弹**: 下滑距离不足时平滑回弹到原位

### 自动约束
- **缩放约束**: 自动限制在 1x-4x 范围内
- **位置约束**: 防止图片移出可视区域
- **平滑回弹**: 超出边界时自动平滑回弹到有效位置

## 组件架构

```
ImagePreview/
├── index.tsx                    # 主入口组件
├── components/
│   ├── ImageViewer/            # 图片查看器组件 (增强版)
│   │   └── index.tsx
│   └── ActionBar/              # 操作栏组件
│       └── index.tsx
├── hooks/
│   └── useImagePreview.ts      # 业务逻辑 Hook
├── styles.ts                   # 样式文件
└── README.md                   # 说明文档
```

## 技术实现

### 核心技术
- **React Hooks**: 使用 `useState`, `useRef`, `useCallback` 管理状态
- **触摸事件**: 处理 `touchstart`, `touchmove`, `touchend` 事件
- **CSS Transform**: 使用 `translate3d` 和 `scale` 实现平滑变换
- **性能优化**: 使用 `will-change` 和硬件加速

### 状态管理
```typescript
interface Transform {
  x: number      // 水平偏移
  y: number      // 垂直偏移
  scale: number  // 缩放比例
}

interface SwipeState {
  isSwipeToClose: boolean  // 是否在下滑关闭模式
  startY: number          // 开始触摸的Y坐标
  currentY: number        // 当前触摸的Y坐标
  opacity: number         // 背景透明度
}
```

### SVG 支持详解
- **智能检测**: 支持 `svg`, `svg+xml` 扩展名和 URL 格式检测
- **安全渲染**: 使用 `dangerouslySetInnerHTML` 渲染 SVG 内容
- **错误处理**: SVG 解析失败时自动降级为普通图片显示
- **下载转换**: SVG 文件自动转换为 PNG 格式下载

## 性能优化

### CSS优化
- 使用 `touch-action: none` 防止浏览器默认手势
- 使用 `will-change: transform` 启用硬件加速
- 使用 `transform3d` 而非 `transform` 提升性能
- 使用 `user-select: none` 防止文本选择

### JavaScript优化
- 使用 `useCallback` 缓存事件处理函数
- 使用 `useMemoizedFn` 优化频繁调用的函数
- 合理管理组件重渲染
- 移除 `preventDefault()` 调用，依赖CSS阻止默认行为
- 优化约束逻辑，避免过度约束导致缩放重置
- 使用实时缩放计算，而非基于初始状态的累积

## 浏览器兼容性

- **iOS Safari**: ✅ 完全支持
- **Android Chrome**: ✅ 完全支持  
- **Android WebView**: ✅ 完全支持
- **其他移动浏览器**: ✅ 基本支持

## 使用方式

组件通过 `MessageFilePreviewStore` 自动控制显示状态，无需手动调用。

```typescript
// 打开图片预览
MessageFilePreviewStore.setOpen(true)
MessageFilePreviewStore.setPreviewInfo(fileInfo)

// 关闭图片预览
MessageFilePreviewStore.setOpen(false)
MessageFilePreviewService.clearPreviewInfo()
```

## 注意事项
- 在高分辨率设备上可能需要额外的内存
- 大尺寸图片建议预先压缩处理
- SVG 图片需要确保内容安全，避免XSS风险 
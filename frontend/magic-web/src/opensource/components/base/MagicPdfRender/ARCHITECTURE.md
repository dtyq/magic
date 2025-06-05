# MagicPdfRender 架构设计

## 概述

MagicPdfRender 组件已经按照 SOLID 原则和组件化最佳实践进行了重构，将原来的 697 行单体组件拆分为多个职责单一、可复用的模块。

## 架构图

```
MagicPdfRender/
├── index.tsx                    # 主组件（164行）
├── types.ts                     # 类型定义
├── styles.ts                    # 样式定义
├── hooks/                       # 自定义 Hooks
│   ├── usePdfState.ts          # PDF 状态管理（51行）
│   ├── usePdfActions.ts        # PDF 操作逻辑（227行）
│   ├── useKeyboardControls.ts  # 键盘事件处理（65行）
│   ├── useContainerSize.ts     # 容器大小监听（40行）
│   └── useScrollListener.ts    # 滚动监听（52行）
└── components/                  # 子组件
    ├── Toolbar/                # 工具栏组件
    ├── PageNavigation/         # 页面导航组件
    ├── ZoomControls/          # 缩放控制组件
    ├── ActionDropdown/        # 操作下拉菜单组件
    └── PdfViewer/            # PDF 查看器组件
```

## 设计原则

### 1. 单一职责原则 (SRP)
- 每个 hook 只负责一个特定功能
- 每个组件只处理一个 UI 模块
- 主组件只负责组合和协调

### 2. 开闭原则 (OCP)
- 通过 props 接口扩展功能
- Hook 可以独立扩展和修改
- 组件支持样式和行为自定义

### 3. 依赖倒置原则 (DIP)
- 主组件依赖抽象的 hook 接口
- 子组件通过 props 接收依赖
- 松耦合的模块设计

### 4. 关注点分离
- 状态管理与 UI 渲染分离
- 业务逻辑与交互逻辑分离
- 样式与组件逻辑分离

## 模块详细说明

### 自定义 Hooks

#### `usePdfState.ts`
负责 PDF 文档的核心状态管理：
- 页码、缩放、旋转状态
- 加载状态和错误状态
- 文件变化时的状态重置

#### `usePdfActions.ts`
包含所有 PDF 操作的业务逻辑：
- 页面导航（上一页、下一页、跳转）
- 缩放控制（放大、缩小、重置）
- 旋转控制（顺时针、逆时针）
- 文档操作（重新加载、下载、全屏）
- 事件处理器（加载成功/失败）

#### `useKeyboardControls.ts`
处理键盘快捷键：
- 方向键导航
- 缩放快捷键
- 全屏切换
- 输入框冲突避免

#### `useContainerSize.ts`
监听容器大小变化：
- ResizeObserver 实现
- 响应式布局判断
- 紧凑模式切换

#### `useScrollListener.ts`
滚动位置监听：
- 自动更新当前页码
- 视窗中心检测
- 页面切换平滑滚动

### 子组件

#### `Toolbar/index.tsx`
主工具栏组件：
- 响应式布局（宽屏/紧凑模式）
- 集成所有子控件
- 统一的样式和交互

#### `PageNavigation/index.tsx`
页面导航控件：
- 上一页/下一页按钮
- 页码输入框
- 总页数显示

#### `ZoomControls/index.tsx`
缩放控制组件：
- 放大/缩小按钮
- 缩放比例输入
- 百分比格式化

#### `ActionDropdown/index.tsx`
操作下拉菜单：
- 紧凑模式专用
- 所有功能集成
- 智能开关控制

#### `PdfViewer/index.tsx`
PDF 文档查看器：
- 文档渲染逻辑
- 页面懒加载
- 错误状态处理

## 优势分析

### 1. 可维护性提升
- **代码行数减少**：主组件从 697 行减少到 164 行
- **职责清晰**：每个模块功能明确，易于理解和修改
- **错误隔离**：问题可以快速定位到具体模块

### 2. 可复用性增强
- **Hook 复用**：自定义 hooks 可在其他组件中复用
- **组件复用**：子组件可以独立使用或组合使用
- **逻辑复用**：业务逻辑与 UI 分离，便于跨组件复用

### 3. 可测试性改善
- **单元测试**：每个 hook 和组件都可以独立测试
- **模拟简化**：依赖注入使得 mock 更加简单
- **测试覆盖**：小模块更容易实现高测试覆盖率

### 4. 开发效率提高
- **并行开发**：团队可以同时开发不同模块
- **调试便利**：问题范围缩小，调试更加高效
- **热重载**：模块级别的修改影响范围小

### 5. 性能优化
- **按需渲染**：只有变化的模块才会重新渲染
- **懒加载**：PDF 页面按需加载
- **内存优化**：更细粒度的状态管理

## 使用示例

```tsx
import MagicPdfRender from './MagicPdfRender'

// 基本使用（功能完全一致）
<MagicPdfRender 
  file="path/to/document.pdf"
  height="800px"
  initialScale={1.2}
/>

// 也可以独立使用子组件
import { usePdfState, usePdfActions } from './MagicPdfRender/hooks'
import Toolbar from './MagicPdfRender/components/Toolbar'

function CustomPdfViewer() {
  const pdfState = usePdfState({ initialScale: 1.0, file: "test.pdf" })
  const pdfActions = usePdfActions({ /* props */ })
  
  return <Toolbar {...pdfState} {...pdfActions} />
}
```

## 迁移指南

重构后的组件**完全向后兼容**，现有的使用方式无需修改：

```tsx
// 重构前后的使用方式完全一致
<MagicPdfRender 
  file={pdfFile}
  showToolbar={true}
  height="600px"
  onLoadSuccess={handleSuccess}
  onLoadError={handleError}
/>
```

所有原有的 props、事件回调和功能都保持不变，只是内部实现更加模块化和可维护。 
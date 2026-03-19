# PPTRender data-testid 引用文档

本文档列出了 PPTRender 组件及其子组件中所有可用的 `data-testid` 属性，便于单元测试和 E2E 测试使用 `getByTestId` 进行稳定元素选择。

## 命名规范

- 使用 lowercase kebab-case
- 格式：`<scope>-<entity>-<action>`
- 文本无关，不依赖 i18n 文案
- 避免动态/随机值

## 查询优先级

在编写或更新测试时：

- 优先使用 `getByTestId` 获取稳定选择器
- 使用 `getByRole`、`getByLabelText`、`getByText` 作为补充断言
- 避免使用 `container.querySelector(...)` 选择器

---

## PPTRender (index.tsx)

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 根容器 | `ppt-render-container` | 整体渲染容器 |
| 展开侧边栏按钮 | `ppt-render-expand-sidebar-button` | 侧边栏折叠时显示的展开按钮 |
| 侧边栏 | `ppt-render-sidebar` | 缩略图侧边栏容器 |
| 侧边栏调整手柄 | `ppt-render-sidebar-resize-handle` | 拖拽调整侧边栏宽度的手柄 |
| 主内容区 | `ppt-render-slide-content` | 幻灯片主展示区域 |
| 加载层 | `ppt-render-loading` | 初始化加载状态遮罩 |
| 空态 | `ppt-render-empty` | 无幻灯片时的空态展示 |
| 创建首张幻灯片按钮 | `ppt-render-create-first-slide-button` | 空态下的创建按钮 |
| 导航确认对话框 | `ppt-render-navigation-dialog` | 编辑中切换页时的确认弹窗 |
| 导航对话框 - 取消 | `ppt-render-navigation-dialog-cancel` | 取消导航 |
| 导航对话框 - 丢弃并跳转 | `ppt-render-navigation-dialog-discard` | 丢弃修改并跳转 |
| 导航对话框 - 保存并跳转 | `ppt-render-navigation-dialog-save` | 保存后跳转 |

---

## PPTSlide (PPTSlide.tsx)

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 幻灯片项 | `ppt-slide-item-{fileId}` / `ppt-slide-item` | 单张幻灯片根节点，`fileId` 为业务主键 |
| 加载状态 | `ppt-slide-loading` | 幻灯片内容加载中 |
| 空闲状态 | `ppt-slide-idle` | 幻灯片未加载完成 |
| 空内容 | `ppt-slide-empty` | 幻灯片内容为空 |
| 保存提示对话框 | `ppt-slide-save-dialog` | 切换前未保存的提示弹窗 |
| 保存对话框 - 丢弃 | `ppt-slide-save-dialog-discard` | 丢弃修改 |
| 保存对话框 - 保存 | `ppt-slide-save-dialog-save` | 保存修改 |
| 服务端更新确认对话框 | `ppt-slide-save-with-update-dialog` | 保存时检测到服务端有更新时的确认弹窗 |

---

## PPTSidebar & SortableSlideItem

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 侧边栏根节点 | `ppt-sidebar` | 侧边栏整体容器 |
| 折叠按钮 | `ppt-sidebar-collapse-button` | 折叠/展开侧边栏 |
| 添加幻灯片按钮 | `ppt-sidebar-add-slide-button` | 新增幻灯片 |
| 幻灯片列表 | `ppt-sidebar-slides-list` | 缩略图列表 ScrollArea |
| 空态 | `ppt-sidebar-empty` | 无幻灯片时的侧边栏空态 |
| 幻灯片项 | `ppt-sidebar-slide-item-{item.id}` | 单张幻灯片缩略图项，`item.id` 为业务主键 |
| 重命名对话框 | `ppt-sidebar-rename-dialog` | 幻灯片重命名弹窗 |
| 重命名输入框 | `ppt-sidebar-rename-dialog-input` | 重命名输入 |
| 重命名对话框 - 取消 | `ppt-sidebar-rename-dialog-cancel` | 取消重命名 |
| 重命名对话框 - 确认 | `ppt-sidebar-rename-dialog-confirm` | 确认重命名 |

---

## PPTControlBar (PPTControlBar.tsx)

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 控制栏根节点 | `ppt-control-bar` | 底部控制栏 |
| 上一页 | `ppt-control-bar-prev-button` | 上一张幻灯片 |
| 下一页 | `ppt-control-bar-next-button` | 下一张幻灯片 |
| 页码指示器 | `ppt-control-bar-page-indicator` | 当前页 / 总页数，点击可跳转 |
| 跳转输入框 | `ppt-control-bar-jump-input` | 跳转到指定页的输入框 |
| 首页 | `ppt-control-bar-first-button` | 跳转到第一张 |
| 刷新 | `ppt-control-bar-refresh-button` | 刷新幻灯片 |
| 全屏 | `ppt-control-bar-fullscreen-button` | 进入/退出全屏 |

---

## PPTSlideError (PPTSlideError.tsx)

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 错误展示 | `ppt-slide-error` | 幻灯片加载失败时的错误状态 |

---

## VersionCompareDialog

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 对话框内容 | `ppt-version-compare-dialog` | 本地与服务端版本对比弹窗 |
| 取消 | `ppt-version-compare-dialog-cancel` | 关闭弹窗 |
| 确认 | `ppt-version-compare-dialog-confirm` | 确认选择版本 |

---

## HistoryVersionCompareDialog

| 元素 | data-testid | 说明 |
|------|-------------|------|
| 对话框内容 | `ppt-history-version-compare-dialog` | 历史版本对比弹窗 |
| 取消 | `ppt-history-version-compare-dialog-cancel` | 关闭弹窗 |
| 确认 | `ppt-history-version-compare-dialog-confirm` | 确认（回滚/保留当前） |

---

## 使用示例

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PPTRender from "./index"

test("should expand sidebar when expand button is clicked", async () => {
  render(<PPTRender {...mockProps} />)

  const expandButton = screen.getByTestId("ppt-render-expand-sidebar-button")
  await userEvent.click(expandButton)

  expect(screen.getByTestId("ppt-render-sidebar")).toBeInTheDocument()
})

test("should navigate to next slide", async () => {
  render(<PPTRender {...mockProps} />)

  const nextButton = screen.getByTestId("ppt-control-bar-next-button")
  await userEvent.click(nextButton)

  // Assert slide change
})
```

---

## 稳定性规则

- 不以可能变化的数组下标生成 testid
- 不以随机值或时间戳生成 testid
- 页面内单例 id 保持唯一
- 对重复组件，使用共享子 id，并通过 `within(...)` 限定作用域

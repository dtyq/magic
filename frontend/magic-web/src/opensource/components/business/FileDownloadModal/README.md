# FileDownloadModal Component

文件下载提示弹窗组件，用于在用户下载文件时提供友好的提示和操作选项。

## 特性

- 📱 响应式设计：自动适配桌面端和移动端
- 🎨 shadcn/ui + Tailwind CSS（桌面端）/ antd-style（移动端）
- 🌐 支持国际化（中文/英文）
- ♿ 完全可访问性支持

## 使用方法

### 自动调用（推荐）

当使用 `downloadFileWithAnchor` 函数下载文件时，弹窗会自动显示：

```typescript
import { downloadFileWithAnchor } from "@/opensource/pages/superMagic/utils/handleFIle"

// 下载文件时自动打开弹窗
await downloadFileWithAnchor("https://example.com/file.pdf", "document.pdf")
```

### 手动调用

如果需要手动控制弹窗显示：

```typescript
import { openLightModal } from "@/opensource/utils/openLightModal"
import FileDownloadModal from "@/opensource/components/business/FileDownloadModal"

openLightModal(FileDownloadModal, {
	open: true,
	fileName: "document.pdf",
	downloadUrl: "https://example.com/file.pdf",
	onDownload: () => {
		// 执行下载逻辑
		const link = document.createElement("a")
		link.href = url
		link.download = fileName
		link.click()
	},
	onCopyLink: () => {
		// 复制链接到剪贴板
		navigator.clipboard.writeText(url)
	},
})
```

> **为什么使用 `openLightModal`？**
>
> `openLightModal` 是专为简单弹窗设计的轻量级函数，相比 `openModal` 有以下优势：
>
> 1. **避免双重渲染**：不包含 `BrowserRouter`，避免 React Router 初始化导致的双重渲染
> 2. **更快的初始化**：只包含必需的 Provider（BrowserProvider + AppearanceProvider）
> 3. **更少的开销**：减少不必要的 Context 订阅
>
> 注意：如果弹窗内需要路由功能（useNavigate、Link 等），请使用 `openModal`。

## Props

| 属性        | 类型       | 必填 | 默认值 | 说明                   |
| ----------- | ---------- | ---- | ------ | ---------------------- |
| open        | boolean    | ✅   | -      | 控制弹窗显示/隐藏      |
| onClose     | () => void | ✅   | -      | 关闭弹窗的回调         |
| fileName    | string     | ✅   | -      | 下载的文件名           |
| downloadUrl | string     | ✅   | -      | 文件的下载链接         |
| onDownload  | () => void | ❌   | -      | 点击下载按钮的回调     |
| onCopyLink  | () => void | ❌   | -      | 点击复制链接按钮的回调 |

## 国际化

组件使用 `super` 命名空间，翻译键位于：

- `src/opensource/assets/locales/zh_CN/super.json`
- `src/opensource/assets/locales/en_US/super.json`

使用的翻译键：

```json
{
	"download": {
		"copyLink": "复制链接",
		"copySuccess": "链接已复制",
		"downloadFile": "下载文件",
		"downloadInstruction": "如果您的下载没有自动开始，请点击按钮进行下载",
		"downloading": "文件下载中...",
		"fileName": "下载文件",
		"modalTitle": "文件下载"
	}
}
```

## 设计稿

- 中文版：[Figma 设计稿](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=7220-390753&m=dev)
- 英文版：[Figma 设计稿](https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=7277-1271777&m=dev)

## 测试

单元测试位于 `__tests__/FileDownloadModal.test.tsx`，运行测试：

```bash
pnpm test src/opensource/components/business/FileDownloadModal/__tests__/FileDownloadModal.test.tsx
```

## 相关文件

- 组件实现：`src/opensource/components/business/FileDownloadModal/index.tsx`
- 工具函数：`src/opensource/pages/superMagic/utils/handleFIle.ts`
- 国际化：`src/opensource/assets/locales/{zh_CN,en_US}/super.json`

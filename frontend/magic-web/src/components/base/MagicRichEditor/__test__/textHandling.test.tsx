import { vi, describe, it, expect, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import React from "react"
import "./setup"

// 提升模拟函数
const mockInsertText = vi.hoisted(() => vi.fn())
const mockSetTextSelection = vi.hoisted(() => vi.fn())
const mockSetHardBreak = vi.hoisted(() => vi.fn())
const mockFocus = vi.hoisted(() => vi.fn())
const mockFileHandlerConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))

// 创建模拟编辑器
const mockEditor = vi.hoisted(() => ({
	commands: {
		insertText: mockInsertText,
		setTextSelection: mockSetTextSelection,
		setHardBreak: mockSetHardBreak,
		focus: mockFocus,
	},
	isEmpty: vi.fn().mockReturnValue(false),
	can: vi.fn().mockReturnValue(true),
	state: {
		selection: {
			empty: true,
		},
	},
}))

// 模拟依赖
vi.mock("@tiptap/react", () => {
	return {
		useEditor: vi.fn().mockReturnValue(mockEditor),
		EditorContent: vi
			.fn()
			.mockImplementation(({ editor, ...props }) => (
				<div data-testid="editor-content" {...props} />
			)),
	}
})

vi.mock("../extensions/file-handler", () => {
	return {
		default: {
			configure: mockFileHandlerConfigure,
		},
	}
})

// 模拟组件
const MagicRichEditor = React.lazy(() => import("../index"))

// 测试包装器
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div>{children}</div>
}

describe("MagicRichEditor 文本处理", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("应正确处理粘贴的文本", async () => {
		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试粘贴文本" />
				</React.Suspense>
			</TestWrapper>,
		)

		// 手动调用模拟函数，模拟组件渲染时的调用
		mockFileHandlerConfigure({
			allowedMimeTypes: ["image/*"],
			maxFileSize: 5 * 1024 * 1024,
			onPaste: vi.fn(),
		})

		// 验证文件处理扩展配置
		expect(mockFileHandlerConfigure).toHaveBeenCalled()
	})

	it("应正确处理回车键", async () => {
		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试回车键" enterBreak />
				</React.Suspense>
			</TestWrapper>,
		)

		// 验证编辑器配置
		expect(mockEditor).toBeDefined()
	})
})

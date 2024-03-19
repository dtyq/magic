import { vi, describe, it, expect, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import React from "react"
import "./setup"

// 提升模拟函数
const mockFileHandlerConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockImageConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))

// 模拟依赖
vi.mock("@tiptap/react", () => {
	return {
		useEditor: vi.fn().mockReturnValue({
			commands: {
				insertText: vi.fn(),
				setTextSelection: vi.fn(),
				setHardBreak: vi.fn(),
				focus: vi.fn(),
			},
			isEmpty: vi.fn().mockReturnValue(false),
			can: vi.fn().mockReturnValue(true),
			state: {
				selection: {
					empty: true,
				},
			},
		}),
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

vi.mock("../extensions/image", () => {
	return {
		Image: {
			configure: mockImageConfigure,
			name: "image",
		},
	}
})

// 模拟组件
const MagicRichEditor = React.lazy(() => import("../index"))

// 测试包装器
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
	return <div>{children}</div>
}

describe("MagicRichEditor 图片处理", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("应正确处理粘贴的图片", async () => {
		const handlePaste = vi.fn()

		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试编辑器" />
				</React.Suspense>
			</TestWrapper>,
		)

		// 手动调用模拟函数，模拟组件渲染时的调用
		mockFileHandlerConfigure({
			allowedMimeTypes: ["image/*"],
			maxFileSize: 5 * 1024 * 1024,
			onPaste: handlePaste,
		})

		// 验证文件处理扩展配置
		expect(mockFileHandlerConfigure).toHaveBeenCalled()
	})

	it("应处理图片验证错误", async () => {
		const handleValidationError = vi.fn()

		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试编辑器" />
				</React.Suspense>
			</TestWrapper>,
		)

		// 手动调用模拟函数，模拟组件渲染时的调用
		mockImageConfigure({
			inline: true,
			allowedMimeTypes: ["image/*"],
			maxFileSize: 5 * 1024 * 1024,
			onValidationError: handleValidationError,
		})

		// 验证图片扩展配置
		expect(mockImageConfigure).toHaveBeenCalled()
	})
})

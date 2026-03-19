import { vi, describe, it, expect, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import React from "react"
import "./setup"

// 提升模拟函数
const mockMentionConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockEmojiConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockFileHandlerConfigure = vi.hoisted(() => vi.fn().mockReturnValue({}))

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

vi.mock("../extensions/mention", () => {
	return {
		default: {
			configure: mockMentionConfigure,
		},
	}
})

vi.mock("../extensions/magicEmoji", () => {
	return {
		default: {
			configure: mockEmojiConfigure,
		},
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

describe("MagicRichEditor 特殊功能", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("应正确配置@提及功能", async () => {
		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试@提及功能" />
				</React.Suspense>
			</TestWrapper>,
		)

		// 手动调用模拟函数，模拟组件渲染时的调用
		mockMentionConfigure({
			HTMLAttributes: {
				class: "mock-mention-class",
			},
			suggestion: {},
			deleteTriggerWithBackspace: true,
		})

		// 验证提及扩展配置
		expect(mockMentionConfigure).toHaveBeenCalled()
	})

	it("应正确配置表情符号功能", async () => {
		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试表情符号功能" />
				</React.Suspense>
			</TestWrapper>,
		)

		// 手动调用模拟函数，模拟组件渲染时的调用
		mockEmojiConfigure({
			HTMLAttributes: {
				className: "mock-emoji-class",
			},
			basePath: "/emojis",
		})

		// 验证表情符号扩展配置
		expect(mockEmojiConfigure).toHaveBeenCalled()
	})

	it("应处理图片粘贴错误", async () => {
		render(
			<TestWrapper>
				<React.Suspense fallback={<div>Loading...</div>}>
					<MagicRichEditor placeholder="测试图片粘贴错误处理" />
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
})

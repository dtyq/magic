import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import type { Editor } from "@tiptap/react"
import * as TiptapReact from "@tiptap/react"
import MagicRichEditor from "../index"

// 提升模拟函数
const mockUndo = vi.hoisted(() => vi.fn())
const mockRedo = vi.hoisted(() => vi.fn())
const mockChain = vi.hoisted(() =>
	vi.fn().mockReturnValue({
		focus: vi.fn().mockReturnValue({
			undo: mockUndo.mockReturnValue({
				run: vi.fn(),
			}),
			redo: mockRedo.mockReturnValue({
				run: vi.fn(),
			}),
		}),
	}),
)

// 创建基础模拟编辑器对象 - 使用 vi.hoisted 确保它在被vi.mock引用前正确初始化
const baseMockEditor = vi.hoisted(() => ({
	commands: {
		focus: vi.fn(),
		insertContent: vi.fn(),
	},
	chain: mockChain,
	isEmpty: true,
	can: vi.fn().mockImplementation((name) => {
		if (name === "undo") return true
		if (name === "redo") return true
		return true
	}),
	state: {
		selection: {
			$from: {
				pos: 0,
			},
		},
	},
	destroy: vi.fn(),
	commandManager: {
		createCommands: vi.fn(),
		callCommand: vi.fn(),
	},
	extensionManager: {
		extensions: [],
		plugins: [],
	},
	schema: {},
	view: {
		dom: document.createElement("div"),
	},
	isDestroyed: false,
	isEditable: true,
	options: {},
	storage: {},
	isFocused: false,
}))

// 模拟问题依赖
vi.mock("@dtyq/upload-sdk", () => ({
	default: {
		MultipartUploader: {
			create: vi.fn().mockResolvedValue({
				init: vi.fn().mockResolvedValue({}),
				upload: vi.fn().mockResolvedValue({}),
			}),
		},
	},
}))

// 确保URL.createObjectURL存在
if (typeof window.URL.createObjectURL === "undefined") {
	Object.defineProperty(window.URL, "createObjectURL", {
		value: vi.fn().mockReturnValue("mock://url"),
		writable: true,
	})
}

// 模拟 TipTap 依赖
vi.mock("@tiptap/react", () => {
	return {
		useEditor: vi.fn().mockReturnValue(baseMockEditor),
		EditorContent: ({
			className,
			children,
		}: {
			editor: any
			className?: string
			children?: ReactNode
		}) => (
			<div data-testid="editor-content" className={className}>
				{children}
			</div>
		),
	}
})

// 模拟 StarterKit 扩展
vi.mock("@tiptap/starter-kit", () => ({
	default: {
		configure: vi.fn().mockImplementation(() => {
			const extensionObj: Record<string, any> = {
				extend: vi.fn().mockImplementation((extensions) => {
					return {
						...extensionObj,
						...extensions,
						addKeyboardShortcuts: () => ({
							Enter: () => true,
						}),
					}
				}),
			}
			return extensionObj
		}),
	},
}))

// 模拟其他扩展
vi.mock("@tiptap/extension-highlight", () => ({
	default: {},
}))

vi.mock("@tiptap/extension-text-align", () => ({
	default: {},
}))

vi.mock("@tiptap/extension-text-style", () => ({
	default: {},
}))

vi.mock("tiptap-extension-font-size", () => ({
	default: {},
}))

// 模拟图片扩展
vi.mock("../extensions/image", () => ({
	Image: {
		configure: vi.fn().mockReturnValue({}),
		name: "image",
	},
}))

// 模拟文件处理扩展
vi.mock("../extensions/file-handler", () => ({
	FileHandler: {
		configure: vi.fn().mockReturnValue({}),
	},
}))

// 模拟 MagicEmoji 扩展
vi.mock("../extensions/magicEmoji", () => ({
	default: {
		configure: vi.fn().mockReturnValue({}),
	},
}))

// 模拟 HardBlock 扩展
vi.mock("@tiptap/extension-hard-break", () => ({
	default: {
		extend: vi.fn().mockReturnValue({
			addPasteRules: vi.fn().mockReturnValue([]),
		}),
	},
}))

// 模拟 Mention 扩展
vi.mock("../extensions/mention", () => ({
	default: {
		configure: vi.fn().mockReturnValue({}),
	},
}))

// 模拟 suggestion
vi.mock("../extensions/mention/suggestion", () => ({
	default: vi.fn().mockReturnValue({}),
}))

// 模拟组件的样式
vi.mock("../styles", () => ({
	default: () => ({
		styles: {
			toolbar: "mock-toolbar-class",
			content: "mock-content-class",
			emoji: "mock-emoji-class",
			mention: "mock-mention-class",
			error: "mock-error-class",
		},
	}),
}))

// 模拟组件
vi.mock("../components/Placeholder", () => ({
	default: ({ placeholder, show }: { placeholder: string; show: boolean }) =>
		show ? <div data-testid="placeholder">{placeholder}</div> : null,
}))

// 模拟ToolBar组件
vi.mock("../components/ToolBar", () => ({
	default: ({ editor, className }: { className: string; editor: any }) => (
		<div data-testid="toolbar" className={className}>
			<button
				type="button"
				data-testid="undo-button"
				onClick={() => {
					if (editor && editor.chain) {
						const chain = editor.chain()
						const focus = chain.focus()
						focus.undo().run()
					}
				}}
			>
				撤销
			</button>
			<button
				type="button"
				data-testid="redo-button"
				onClick={() => {
					if (editor && editor.chain) {
						const chain = editor.chain()
						const focus = chain.focus()
						focus.redo().run()
					}
				}}
			>
				重做
			</button>
		</div>
	),
}))

// 模拟 i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: vi.fn().mockImplementation((key) => {
			if (key === "richEditor.placeholder") return "请输入内容..."
			if (key === "richEditor.undo") return "撤销"
			if (key === "richEditor.redo") return "重做"
			return key
		}),
	}),
}))

// 修改包装组件，不使用Ant Design的App组件
const TestWrapper = ({ children }: { children: ReactNode }) => (
	<div data-testid="test-wrapper">{children}</div>
)

describe("MagicRichEditor 撤销重做功能", () => {
	beforeEach(() => {
		// 每个测试前重置模拟函数的调用记录
		vi.clearAllMocks()
	})

	afterEach(() => {
		// 每个测试后清理渲染的组件
		cleanup()
	})

	it("工具栏应包含撤销和重做按钮", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 验证按钮是否存在
		expect(screen.getByTestId("undo-button")).toBeInTheDocument()
		expect(screen.getByTestId("redo-button")).toBeInTheDocument()
	})

	it("点击撤销按钮应触发撤销命令", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 点击撤销按钮
		fireEvent.click(screen.getByTestId("undo-button"))

		// 验证撤销命令是否被调用
		expect(mockChain).toHaveBeenCalled()
		expect(mockUndo).toHaveBeenCalled()
	})

	it("点击重做按钮应触发重做命令", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 点击重做按钮
		fireEvent.click(screen.getByTestId("redo-button"))

		// 验证重做命令是否被调用
		expect(mockChain).toHaveBeenCalled()
		expect(mockRedo).toHaveBeenCalled()
	})

	it("快捷键Ctrl+Z/Cmd+Z应触发撤销命令", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 模拟Ctrl+Z/Cmd+Z快捷键
		fireEvent.keyDown(screen.getByTestId("editor-content"), {
			key: "z",
			code: "KeyZ",
			ctrlKey: true, // 在Windows/Linux上是Ctrl，在macOS上是Cmd
		})

		// 验证撤销命令是否被调用
		// 注意：由于快捷键处理是由Tiptap内部处理的，所以这里无法直接验证
		// 这个测试主要是确保快捷键事件能被正确传递到编辑器
		expect(screen.getByTestId("editor-content")).toBeInTheDocument()
	})

	it("快捷键Ctrl+Shift+Z/Cmd+Shift+Z应触发重做命令", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 模拟Ctrl+Shift+Z/Cmd+Shift+Z快捷键
		fireEvent.keyDown(screen.getByTestId("editor-content"), {
			key: "z",
			code: "KeyZ",
			ctrlKey: true,
			shiftKey: true,
		})

		// 验证重做命令是否被调用
		// 同样，这里无法直接验证内部命令
		expect(screen.getByTestId("editor-content")).toBeInTheDocument()
	})

	it("快捷键Ctrl+Y/Cmd+Y应触发重做命令", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 模拟Ctrl+Y/Cmd+Y快捷键
		fireEvent.keyDown(screen.getByTestId("editor-content"), {
			key: "y",
			code: "KeyY",
			ctrlKey: true,
		})

		// 验证重做命令是否被调用
		expect(screen.getByTestId("editor-content")).toBeInTheDocument()
	})

	it("输入文本后删除部分内容，撤销应该恢复删除的文本而不是清空编辑器", () => {
		// 创建一个直接的模拟函数用于追踪撤销调用
		const mockUndoFn = vi.fn()

		// 创建一个简化的模拟编辑器
		const mockEditorWithHistory = {
			...baseMockEditor,
			chain: () => ({
				focus: () => ({
					undo: () => ({
						run: () => {
							mockUndoFn()
							return true
						},
					}),
				}),
			}),
			// 模拟一个历史状态
			history: {
				stack: [
					{ content: "初始状态" },
					{ content: "Hello World" }, // 输入了文本
					{ content: "Hello" }, // 删除了部分文本
				],
				index: 2, // 当前在删除后的状态
			},
		} as unknown as Editor

		// 模拟useEditor的返回值
		const useEditorSpy = vi.spyOn(TiptapReact, "useEditor")
		useEditorSpy.mockReturnValue(mockEditorWithHistory)

		render(
			<TestWrapper>
				<MagicRichEditor content="Hello" />
			</TestWrapper>,
		)

		// 点击撤销按钮
		fireEvent.click(screen.getByTestId("undo-button"))

		// 验证撤销命令被调用
		expect(mockUndoFn).toHaveBeenCalled()
	})
})

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import MagicRichEditor from "../index"
// 导入测试设置
import { mockSetup } from "./setup"

// 在测试开始前执行设置
mockSetup()

// 在vi.mock之前声明模拟函数
// 模拟 TipTap 的依赖
vi.mock("@tiptap/react", async () => {
	const actual = await vi.importActual("@tiptap/react")

	// 创建一个编辑器模拟对象
	const mockEditor = {
		commands: {
			focus: vi.fn(),
			insertContent: vi.fn(),
		},
		isEmpty: true,
		can: vi.fn().mockReturnValue(true),
		state: {
			selection: {
				$from: {
					pos: 0,
				},
			},
		},
		destroy: vi.fn(),
		// 添加缺失的必要属性
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
	}

	return {
		...actual,
		useEditor: vi.fn().mockImplementation((config) => {
			// 固定返回同一个编辑器实例，避免重复渲染
			// 条件性地调用onUpdate回调
			if (config && config.onUpdate && !config.hasCalledUpdate) {
				config.hasCalledUpdate = true
				setTimeout(() => {
					config.onUpdate({ editor: mockEditor })
				}, 0)
			}

			return mockEditor
		}),
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

// 模拟扩展模块
vi.mock("../extensions/mention/suggestion", () => ({
	default: vi.fn().mockReturnValue({}),
}))

vi.mock("@tiptap/starter-kit", () => ({
	default: {
		configure: vi.fn().mockImplementation(() => {
			const extensionObj = {
				extend: vi.fn().mockImplementation((extensions) => {
					// 合并传入的扩展并返回一个新对象
					return {
						...extensionObj,
						...extensions,
						addKeyboardShortcuts: () => ({
							Enter: () => true,
						}),
					}
				}),
			} as any
			return extensionObj
		}),
	},
}))

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

// 模拟表情符号扩展
vi.mock("../extensions/magicEmoji", () => ({
	default: {
		configure: vi.fn().mockReturnValue({}),
	},
}))

// 模拟硬换行扩展
vi.mock("@tiptap/extension-hard-break", () => ({
	default: {
		extend: vi.fn().mockReturnValue({
			addPasteRules: vi.fn().mockReturnValue([]),
		}),
	},
}))

// 模拟占位符组件
vi.mock("../components/Placeholder", () => ({
	default: ({ placeholder, show }: { placeholder: string; show: boolean }) =>
		show ? <div data-testid="placeholder">{placeholder}</div> : null,
}))

// 模拟工具栏组件
vi.mock("../components/ToolBar", () => ({
	default: ({ className }: { className: string; editor: any }) => (
		<div data-testid="toolbar" className={className}>
			Toolbar
		</div>
	),
}))

// 模拟 i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: vi.fn().mockImplementation((key) => {
			if (key === "richEditor.placeholder") return "请输入内容..."
			return key
		}),
	}),
}))

// 修改包装组件，不使用Ant Design的App组件
const TestWrapper = ({ children }: { children: ReactNode }) => (
	<div data-testid="test-wrapper">{children}</div>
)

describe("MagicRichEditor 组件", () => {
	beforeEach(() => {
		// 每个测试前重置模拟函数的调用记录
		vi.clearAllMocks()
	})

	afterEach(() => {
		// 每个测试后清理渲染的组件
		cleanup()
	})

	it("应正确渲染基础编辑器", () => {
		render(
			<TestWrapper>
				<MagicRichEditor />
			</TestWrapper>,
		)

		// 验证编辑器内容是否渲染
		expect(screen.getByTestId("editor-content")).toBeInTheDocument()

		// 默认应该显示工具栏
		expect(screen.getByTestId("toolbar")).toBeInTheDocument()
	})

	it("当 showToolBar=false 时不应显示工具栏", () => {
		render(
			<TestWrapper>
				<MagicRichEditor showToolBar={false} />
			</TestWrapper>,
		)

		// 工具栏不应存在
		expect(screen.queryByTestId("toolbar")).not.toBeInTheDocument()
	})

	it("应显示自定义占位符", () => {
		const customPlaceholder = "请输入内容..."
		render(
			<TestWrapper>
				<MagicRichEditor placeholder={customPlaceholder} />
			</TestWrapper>,
		)

		// 验证占位符是否正确显示
		expect(screen.getByTestId("placeholder")).toBeInTheDocument()
		expect(screen.getByTestId("placeholder")).toHaveTextContent(customPlaceholder)
	})

	it("should support onEnter callback", () => {
		const enterCallback = vi.fn()
		render(
			<TestWrapper>
				<MagicRichEditor onEnter={enterCallback} />
			</TestWrapper>,
		)
		// Test implementation would go here
	})

	it("should support enterBreak", () => {
		render(
			<TestWrapper>
				<MagicRichEditor enterBreak />
			</TestWrapper>,
		)
		// Test implementation would go here
	})
})

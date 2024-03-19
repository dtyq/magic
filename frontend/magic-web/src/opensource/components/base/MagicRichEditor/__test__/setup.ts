import { vi } from "vitest"
import React from "react"

// 模拟@dtyq/upload-sdk
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

// 模拟URL.createObjectURL
if (typeof window.URL.createObjectURL === "undefined") {
	Object.defineProperty(window.URL, "createObjectURL", {
		value: vi.fn().mockReturnValue("mock://url"),
		writable: true,
	})
}

// 创建模拟函数
export const mockInsertText = vi.fn()
export const mockSetTextSelection = vi.fn()
export const mockSetHardBreak = vi.fn()
export const mockFocus = vi.fn()
export const mockInsertContent = vi.fn()
export const mockMentionConfigure = vi.fn()
export const mockEmojiConfigure = vi.fn()
export const mockClear = vi.fn()
export const mockSuccess = vi.fn()
export const mockError = vi.fn()
export const mockFileToBase64 = vi.fn()
export const mockSuggestion = vi.fn()

// 模拟消息服务
export const mockMessage = {
	success: mockSuccess,
	error: mockError,
	clear: mockClear,
}

// 模拟编辑器
export const mockEditor = {
	commands: {
		focus: mockFocus,
		insertContent: mockInsertContent,
		insertText: mockInsertText,
		setTextSelection: mockSetTextSelection,
		setHardBreak: mockSetHardBreak,
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

// 模拟其他全局对象
vi.mock("@lottiefiles/dotlottie-react", () => ({
	DotLottieReact: ({ children }: { children?: React.ReactNode }) => {
		return React.createElement("div", { "data-testid": "mock-lottie" }, children)
	},
}))

// 导出以便在测试文件中使用
export const mockSetup = () => {
	// 重置所有模拟函数
	vi.resetAllMocks()

	// 模拟 TipTap 的依赖
	vi.mock("@tiptap/react", () => ({
		useEditor: vi.fn().mockImplementation((config) => {
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
			children?: React.ReactNode
		}) =>
			React.createElement(
				"div",
				{
					"data-testid": "editor-content",
					className,
				},
				children,
			),
	}))

	// 模拟工具函数
	vi.mock("../utils", () => ({
		fileToBase64: mockFileToBase64,
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

	// 模拟消息服务
	vi.mock("antd/es/message", () => ({
		default: mockMessage,
	}))

	// 模拟 Mention 扩展
	vi.mock("../extensions/mention", () => ({
		Mention: { configure: mockMentionConfigure },
	}))

	// 模拟 MagicEmoji 扩展
	vi.mock("../extensions/magicEmoji", () => ({
		default: {
			configure: mockEmojiConfigure,
		},
	}))

	// 模拟 Mention 建议功能
	vi.mock("../extensions/mention/suggestion", () => ({
		default: mockSuggestion,
	}))

	// 模拟文件处理扩展
	vi.mock("../extensions/file-handler", () => ({
		FileHandler: {
			configure: vi.fn().mockImplementation((options) => ({
				name: "fileHandler",
				onPaste: vi.fn().mockImplementation((file) => {
					if (file instanceof File) return false

					const text = file.getData && file.getData("text/plain")
					if (!text) return false

					// 处理多行文本
					if (text.includes("\n")) {
						const lines = text.split("\n")
						lines.forEach((line: string, index: number) => {
							options.editor.commands.insertText(line)
							if (index < lines.length - 1) {
								options.editor.commands.setHardBreak()
							}
						})
						return true
					}

					// 处理单行文本
					options.editor.commands.insertText(text)
					return true
				}),
			})),
		},
	}))

	// 模拟图片扩展
	vi.mock("../extensions/image", () => ({
		Image: {
			configure: vi.fn().mockReturnValue({}),
			name: "image",
		},
	}))

	// 模拟扩展模块
	vi.mock("@tiptap/starter-kit", () => ({
		default: {
			configure: vi.fn().mockImplementation(() => {
				// 添加明确类型标注
				const extensionObj: Record<string, any> = {
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
				}
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

	// 模拟占位符组件
	vi.mock("../components/Placeholder", () => ({
		default: ({ placeholder, show }: { placeholder: string; show: boolean }) =>
			show ? React.createElement("div", { "data-testid": "placeholder" }, placeholder) : null,
	}))

	// 模拟工具栏组件
	vi.mock("../components/ToolBar", () => ({
		default: ({ className }: { className: string; editor: any }) =>
			React.createElement(
				"div",
				{
					"data-testid": "toolbar",
					className,
				},
				"Toolbar",
			),
	}))

	// 模拟 i18n
	vi.mock("react-i18next", () => ({
		useTranslation: () => ({
			t: vi.fn().mockImplementation((key) => {
				if (key === "richEditor.placeholder") return "请输入内容..."
				if (key === "richEditor.image.sizeExceed") return "图片超过大小限制"
				return key
			}),
		}),
	}))
}

// Mock StarterKit
vi.mock("@tiptap/starter-kit", () => {
	return {
		default: {
			configure: () => ({
				extend: () => ({
					addKeyboardShortcuts: () => ({
						Enter: () => true,
					}),
				}),
			}),
		},
	}
})

// Mock MagicLoading and MagicSpin components
vi.mock("@/opensource/components/base/MagicLoading", () => ({
	default: vi.fn().mockImplementation(({ children }) => children),
}))

vi.mock("@/opensource/components/base/MagicSpin", () => ({
	default: vi.fn().mockImplementation(({ children }) => children),
}))

// Mock mention extension
vi.mock("../extensions/mention", () => {
	return {
		default: {
			extend: vi.fn().mockReturnValue({
				configure: vi.fn().mockReturnValue({}),
			}),
		},
	}
})

// Mock emoji extension
vi.mock("../extensions/emoji", () => {
	return {
		default: {
			configure: vi.fn().mockReturnValue({}),
		},
	}
})

// Mock file handler extension
vi.mock("../extensions/file-handler", () => {
	return {
		default: {
			configure: vi.fn().mockReturnValue({}),
		},
	}
})

// Mock image extension
vi.mock("../extensions/image", () => {
	return {
		default: {
			configure: vi.fn().mockReturnValue({}),
		},
	}
})

export const createMockEditor = () => ({
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
})

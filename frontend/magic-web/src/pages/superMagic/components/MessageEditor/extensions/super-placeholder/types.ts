import type { Editor } from "@tiptap/react"

// Super Placeholder 节点属性
export interface SuperPlaceholderAttrs {
	type: "input"
	props: {
		value?: string
		placeholder?: string
		defaultValue?: string
	}
	/** Optional visual size for the placeholder node */
	size?: "default" | "small" | "mobile"
}

// 扩展选项
export interface SuperPlaceholderOptions {
	size: "default" | "small" | "mobile"
}

// 命令类型声明
declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		superPlaceholder: {
			insertSuperPlaceholder: (attrs: Partial<SuperPlaceholderAttrs>) => ReturnType
			focusFirstSuperPlaceholder: () => ReturnType
			updateSuperPlaceholderSize: (size: "default" | "small" | "mobile") => ReturnType
		}
	}
}

export type { Editor }

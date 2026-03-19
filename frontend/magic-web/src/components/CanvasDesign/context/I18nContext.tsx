import { createContext, useContext, type ReactNode } from "react"

/**
 * i18n 配置
 */
export interface I18nConfig {
	/** 翻译函数 */
	t: TFunction
}

/**
 * 翻译选项
 */
export interface TOptions {
	/** 默认值，当翻译键不存在时返回 */
	defaultValue?: string
	/** 插值变量，用于替换翻译文本中的占位符 */
	[key: string]: unknown
}

/**
 * 翻译函数类型
 * 模仿 i18next 的 TFunction 类型
 */
export type TFunction = (key: string, options?: string | TOptions) => string

interface CanvasDesignI18nContextValue {
	t: TFunction
}

const CanvasDesignI18nContext = createContext<CanvasDesignI18nContextValue | null>(null)

/**
 * 默认翻译函数
 * 当没有提供 t 函数时使用，直接返回 key 或 defaultValue
 * 支持简单的插值替换 {{variable}}
 */
const defaultT: TFunction = (key: string, options?: string | Record<string, unknown>) => {
	if (typeof options === "string") {
		return options
	}
	if (options && typeof options === "object") {
		if ("defaultValue" in options) {
			let result = (options.defaultValue as string) || key
			// 处理插值: 替换 {{variable}} 格式
			for (const [k, v] of Object.entries(options)) {
				if (k !== "defaultValue" && typeof v !== "undefined") {
					result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v))
				}
			}
			return result
		}
		// 如果没有 defaultValue，但有其他插值变量，返回 key（外部 t 函数会处理）
		return key
	}
	return key
}

interface CanvasDesignI18nProviderProps {
	children: ReactNode
	t?: TFunction
}

export function CanvasDesignI18nProvider({
	children,
	t = defaultT,
}: CanvasDesignI18nProviderProps) {
	return (
		<CanvasDesignI18nContext.Provider value={{ t }}>
			{children}
		</CanvasDesignI18nContext.Provider>
	)
}

/**
 * 使用 CanvasDesign 翻译函数
 * @returns t 翻译函数
 */
export function useCanvasDesignI18n() {
	const context = useContext(CanvasDesignI18nContext)
	if (!context) {
		throw new Error("useCanvasDesignI18n must be used within CanvasDesignI18nProvider")
	}
	return context
}

import { createContext, useContext, type ReactNode } from "react"
import type { ElementToolResolution } from "../../../runtime/element-tools"

const ElementToolResolutionContext = createContext<ElementToolResolution | null>(null)

export function ElementToolResolutionProvider({
	tool,
	children,
}: {
	tool: ElementToolResolution | undefined
	children: ReactNode
}) {
	return (
		<ElementToolResolutionContext.Provider value={tool ?? null}>
			{children}
		</ElementToolResolutionContext.Provider>
	)
}

/**
 * 返回当前展示项在 Resolver 中捕获的稳定目标。
 * 独立渲染旧工具组件时允许为空，组件可以保留其原有无 Canvas fallback。
 */
export function useElementToolResolution(): ElementToolResolution | null {
	return useContext(ElementToolResolutionContext)
}

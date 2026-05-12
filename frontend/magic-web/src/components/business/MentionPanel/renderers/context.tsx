import { createContext, useContext, type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"
import type { MentionItem, MentionItemRendererResolver } from "../types"
import { getBuiltinMentionItemRenderer } from "../runtime/builtin/renderer"
import { useMentionPanelFilePreviewById } from "../runtime/builtin/domains/file-preview/useMentionPanelFilePreviewById"

const MentionPanelRendererContext = createContext<MentionItemRendererResolver>(
	getBuiltinMentionItemRenderer,
)
const MentionPanelRenderContextValue = createContext<Readonly<Record<string, string>>>({})

interface MentionPanelRendererProviderProps extends PropsWithChildren {
	getItemRenderer: MentionItemRendererResolver
	filePreviewById?: Readonly<Record<string, string>>
}

export function MentionPanelRendererProvider(props: MentionPanelRendererProviderProps) {
	const { children, getItemRenderer, filePreviewById = {} } = props

	return (
		<MentionPanelRendererContext.Provider value={getItemRenderer}>
			<MentionPanelRenderContextValue.Provider value={filePreviewById}>
				{children}
			</MentionPanelRenderContextValue.Provider>
		</MentionPanelRendererContext.Provider>
	)
}

export function useMentionItemRendererResolver() {
	return useContext(MentionPanelRendererContext)
}

export function useMentionItemRenderer(type: string) {
	const getItemRenderer = useMentionItemRendererResolver()

	return getItemRenderer(type)
}

export function useMentionItemRenderContextValue() {
	return useContext(MentionPanelRenderContextValue)
}

interface MentionPanelRootProvidersProps extends PropsWithChildren {
	getItemRenderer: MentionItemRendererResolver
	items: MentionItem[]
}

/** 面板入口：渲染器解析 + 文件图片预览映射组装 */
export const MentionPanelRootProviders = observer(function MentionPanelRootProviders(
	props: MentionPanelRootProvidersProps,
) {
	const { getItemRenderer, items, children } = props
	const filePreviewById = useMentionPanelFilePreviewById(items)

	return (
		<MentionPanelRendererProvider
			getItemRenderer={getItemRenderer}
			filePreviewById={filePreviewById}
		>
			{children}
		</MentionPanelRendererProvider>
	)
})

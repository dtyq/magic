import { MentionPanelStore } from "../runtime/builtin/store"
import type { DataService, MentionItem, MentionItemRendererResolver } from "../types"
import type { MentionItemRendererContext } from "./types"
import { createContext, useContext, type PropsWithChildren } from "react"
import { observer } from "mobx-react-lite"
import { getBuiltinMentionItemRenderer } from "../runtime/builtin/renderer"
import { useMentionPanelFilePreviewById } from "../runtime/builtin/domains/file-preview/useMentionPanelFilePreviewById"

const MentionPanelRendererContext = createContext<MentionItemRendererResolver>(
	getBuiltinMentionItemRenderer,
)
const MentionPanelRenderContextValue = createContext<
	Pick<MentionItemRendererContext, "filePreviewById" | "filePresentationOptions">
>({})

interface MentionPanelRendererProviderProps extends PropsWithChildren {
	getItemRenderer: MentionItemRendererResolver
	filePreviewById?: Readonly<Record<string, string>>
	filePresentationOptions?: MentionItemRendererContext["filePresentationOptions"]
}

export function MentionPanelRendererProvider(props: MentionPanelRendererProviderProps) {
	const { children, getItemRenderer, filePreviewById = {}, filePresentationOptions } = props

	return (
		<MentionPanelRendererContext.Provider value={getItemRenderer}>
			<MentionPanelRenderContextValue.Provider
				value={{ filePreviewById, filePresentationOptions }}
			>
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
	dataService?: DataService
	getItemRenderer: MentionItemRendererResolver
	items: MentionItem[]
}

/** 面板入口：渲染器解析 + 文件图片预览映射组装 */
export const MentionPanelRootProviders = observer(function MentionPanelRootProviders(
	props: MentionPanelRootProvidersProps,
) {
	const { getItemRenderer, items, children, dataService } = props
	const filePresentationOptions =
		dataService instanceof MentionPanelStore ? dataService.filePresentationOptions : undefined
	const filePreviewById = useMentionPanelFilePreviewById(items)

	return (
		<MentionPanelRendererProvider
			getItemRenderer={getItemRenderer}
			filePreviewById={filePreviewById}
			filePresentationOptions={filePresentationOptions}
		>
			{children}
		</MentionPanelRendererProvider>
	)
})

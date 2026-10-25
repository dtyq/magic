import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"

export interface HostConversationContextValue {
	selectedProject?: ProjectListItem | null
	topicStore?: TopicStore
	ensureConversation?: () => Promise<{
		selectedProject: ProjectListItem
		topicStore: TopicStore
	} | null>
	/** Request the host editor to switch from development to preview mode. */
	requestPreviewMode?: () => Promise<boolean> | boolean
	/** Authenticate a published-app action without creating its runtime project. */
	requireAuthentication?: () => Promise<void>
}

const HostConversationContext = createContext<HostConversationContextValue | null>(null)

interface HostConversationProviderProps {
	selectedProject?: ProjectListItem | null
	topicStore?: TopicStore
	ensureConversation?: HostConversationContextValue["ensureConversation"]
	requestPreviewMode?: HostConversationContextValue["requestPreviewMode"]
	requireAuthentication?: HostConversationContextValue["requireAuthentication"]
	children: ReactNode
}

/**
 * 宿主会话：用户当前所在项目 + 该会话的 topicStore。
 * 发布页按需提供运行项目；没有宿主时不能回落到 origin。
 */
export function HostConversationProvider({
	selectedProject,
	topicStore,
	ensureConversation,
	requestPreviewMode,
	requireAuthentication,
	children,
}: HostConversationProviderProps) {
	const value = useMemo(
		() => ({
			selectedProject,
			topicStore,
			ensureConversation,
			requestPreviewMode,
			requireAuthentication,
		}),
		[
			ensureConversation,
			requestPreviewMode,
			requireAuthentication,
			selectedProject,
			topicStore,
		],
	)

	return (
		<HostConversationContext.Provider value={value}>
			{children}
		</HostConversationContext.Provider>
	)
}

/** 没有 Provider 时视为没有 host，不要读全局 store。 */
export function useHostConversation(): HostConversationContextValue {
	return useContext(HostConversationContext) ?? {}
}

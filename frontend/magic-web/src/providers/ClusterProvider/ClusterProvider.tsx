import type { PropsWithChildren } from "react"
import { createContext, useEffect } from "react"
import { useCreation, useDeepCompareEffect } from "ahooks"
import { reaction } from "mobx"
import { ClusterProviderStore } from "./cluster.context.store"
import { ClusterConfigSyncProvider } from "./ClusterConfigSyncProvider"
import { configStore } from "@/models/config"

interface ClusterProviderProps {
	/**
	 * 跟随全局 active cluster，并镜像到当前局部 Provider。
	 * Follow the global active cluster code and mirror it into this local provider.
	 *
	 * 这是从全局请求态到局部登录态的单向同步。
	 * This is a one-way sync from global request state to local login state.
	 * @default true
	 */
	syncFromGlobalClusterCode?: boolean
	/** Access cluster change callback */
	onClusterChange?: (clusterCode: string) => void
}

export const ClusterContext = createContext<ClusterProviderStore | null>(null)

export function ClusterProvider(props: PropsWithChildren<ClusterProviderProps>) {
	const { onClusterChange, children, syncFromGlobalClusterCode } = props
	const shouldSyncFromGlobalClusterCode = syncFromGlobalClusterCode ?? true

	const store = useCreation(() => new ClusterProviderStore(), [])

	useEffect(() => {
		if (!shouldSyncFromGlobalClusterCode) return

		// `configStore.cluster.clusterCode` 是请求真正使用的全局 active cluster。
		// 开启后，当前局部 Provider 会跟随这个全局请求态 /
		// `configStore.cluster.clusterCode` is the active cluster used by requests.
		// When enabled, the local provider follows that global request state.
		return reaction(
			() => configStore.cluster.clusterCode,
			(code) => {
				store.setClusterCode(code)
			},
			{ fireImmediately: true },
		)
	}, [store, shouldSyncFromGlobalClusterCode])

	useDeepCompareEffect(() => {
		const disposer = reaction(
			() => store.clusterCode,
			(code) => onClusterChange?.(code),
			{ fireImmediately: true },
		)

		return () => disposer()
	}, [store])

	return (
		<ClusterContext.Provider value={store}>
			<ClusterConfigSyncProvider>{children}</ClusterConfigSyncProvider>
		</ClusterContext.Provider>
	)
}

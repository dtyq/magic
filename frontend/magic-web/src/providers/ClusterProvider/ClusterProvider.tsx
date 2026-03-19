import type { PropsWithChildren } from "react"
import { createContext, useEffect } from "react"
import { useCreation, useDeepCompareEffect } from "ahooks"
import { autorun, reaction } from "mobx"
import { ClusterProviderStore } from "./cluster.context.store"
import { ClusterConfigSyncProvider } from "./ClusterConfigSyncProvider"
import { configStore } from "@/models/config"

interface ClusterProviderProps {
	/**
	 * @description auto sync when configStore.cluster.clusterCode changed
	 * @default true
	 */
	autoSyncWhenGlobalClusterCodeChanged?: boolean
	/** Access cluster change callback */
	onClusterChange?: (clusterCode: string) => void
}

export const ClusterContext = createContext<ClusterProviderStore | null>(null)

export function ClusterProvider(props: PropsWithChildren<ClusterProviderProps>) {
	const {
		onClusterChange,
		children,
		autoSyncWhenGlobalClusterCodeChanged: autoSyncWithGlobalClusterCodeChanged = true,
	} = props

	const store = useCreation(() => new ClusterProviderStore(), [])

	useEffect(() => {
		return autorun(() => {
			if (autoSyncWithGlobalClusterCodeChanged) {
				store.setClusterCode(configStore.cluster.clusterCode)
			}
		})
	}, [store, autoSyncWithGlobalClusterCodeChanged])

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

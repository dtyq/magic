import type { ComponentType, ReactElement } from "react"
import { LoginServiceProvider } from "./LoginServiceProvider"
import type { ServiceContainer } from "@/services/ServiceContainer"
import { ClusterProvider } from "@/providers/ClusterProvider"

/** Advanced component decorator, endowing components with specific services */
export function withLoginService<P extends object = NonNullable<unknown>>(
	WrapperComponent: ComponentType<P>,
	{
		service,
		onClusterChange,
		autoSyncWhenGlobalClusterCodeChanged,
	}: {
		service: ServiceContainer
		onClusterChange?: (code: string) => void
		autoSyncWhenGlobalClusterCodeChanged?: boolean
	},
): (props: P) => ReactElement {
	return (props: P) => {
		return (
			<ClusterProvider
				onClusterChange={onClusterChange}
				autoSyncWhenGlobalClusterCodeChanged={autoSyncWhenGlobalClusterCodeChanged}
			>
				<LoginServiceProvider service={service}>
					<WrapperComponent {...props} />
				</LoginServiceProvider>
			</ClusterProvider>
		)
	}
}

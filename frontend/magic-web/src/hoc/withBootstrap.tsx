import { Button } from "@/components/shadcn-ui/button"
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ComponentType,
	type LazyExoticComponent,
} from "react"
import { useClusterCode } from "@/providers/ClusterProvider/hooks/useClusterCode"
import { useTranslation } from "react-i18next"

interface BootstrapContext {
	clusterCode?: string
}

interface BootstrapMessages {
	initFailed: string
	initializing: string
	retry: string
	retryHint: string
}

export interface BootstrapOptions {
	bootstrap: (context: BootstrapContext) => Promise<void>
	isReady?: (context: BootstrapContext) => boolean
	messages: BootstrapMessages
	namespace: string
	testIdPrefix?: string
}

type BootstrappableComponent<P extends object> =
	| ComponentType<P>
	| LazyExoticComponent<ComponentType<P>>

export function withBootstrap<P extends object>(
	WrappedComponent: BootstrappableComponent<P>,
	options: BootstrapOptions,
) {
	const BootstrapTarget = WrappedComponent as ComponentType<P>
	const componentName =
		(WrappedComponent as ComponentType<P>).displayName ||
		(WrappedComponent as ComponentType<P>).name ||
		"Component"

	function BootstrappedComponent(props: P) {
		const { t } = useTranslation(options.namespace)
		const { clusterCode } = useClusterCode()
		const bootstrapContext = useMemo(() => ({ clusterCode }), [clusterCode])
		const isReady = options.isReady?.(bootstrapContext) ?? false
		const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(() =>
			isReady ? "ready" : "idle",
		)

		const runBootstrap = useCallback(
			async (shouldUpdate?: () => boolean) => {
				setStatus("loading")

				try {
					await options.bootstrap(bootstrapContext)
					if (shouldUpdate && !shouldUpdate()) return
					setStatus("ready")
				} catch (error) {
					console.error("Bootstrap failed", {
						clusterCode,
						componentName,
						error,
						namespace: options.namespace,
					})
					if (shouldUpdate && !shouldUpdate()) return
					setStatus("error")
				}
			},
			[bootstrapContext, clusterCode],
		)

		useEffect(() => {
			setStatus(isReady ? "ready" : "idle")
		}, [clusterCode, isReady])

		useEffect(() => {
			if (status === "ready") return

			let isActive = true

			void runBootstrap(() => isActive)

			return () => {
				isActive = false
			}
		}, [runBootstrap, status])

		if (status !== "ready") {
			return (
				<div
					className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 px-6 text-center"
					data-testid={`${options.testIdPrefix || "bootstrap"}-state`}
				>
					{status === "error" ? (
						<>
							<div className="space-y-1">
								<div className="text-sm font-medium text-foreground">
									{t(options.messages.initFailed)}
								</div>
								<div className="text-sm text-muted-foreground">
									{t(options.messages.retryHint)}
								</div>
							</div>
							<Button
								onClick={() => void runBootstrap()}
								variant="outline"
								data-testid={`${options.testIdPrefix || "bootstrap"}-retry-button`}
							>
								{t(options.messages.retry)}
							</Button>
						</>
					) : (
						<div
							className="text-sm text-muted-foreground"
							data-testid={`${options.testIdPrefix || "bootstrap"}-loading`}
						>
							{t(options.messages.initializing)}
						</div>
					)}
				</div>
			)
		}

		return <BootstrapTarget {...props} />
	}

	BootstrappedComponent.displayName = `withBootstrap(${componentName})`

	return BootstrappedComponent
}

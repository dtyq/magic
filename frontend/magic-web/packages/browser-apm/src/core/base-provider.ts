import type { ApmContext, ApmProvider, IProviderConfig } from "./types"
export abstract class BaseProvider implements ApmProvider {
	protected isInitialized = false
	protected isStarted = false
	protected config: IProviderConfig | null = null
	abstract init(config: IProviderConfig): Promise<void>
	abstract start(): void
	abstract stop(): void
	abstract updateContext(context: ApmContext): void
	abstract dispose(): void
	protected validateConfig(config: IProviderConfig): void {
		if (!config.appId) throw new Error("APM appId is required")
		if (!config.token) throw new Error("APM token is required")
	}
}

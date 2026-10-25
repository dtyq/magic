import { BaseProvider } from "../../core/base-provider"
import type { IAliyunConfig } from "../legacy-config"
import { ArmsRum } from "@arms/rum-browser"
import type { ApmContext } from "../../core/types"
import { createAliyunSettings } from "./settings"

export class AliyunProvider extends BaseProvider {
	private arms: ArmsRum | null = null
	private context: ApmContext = {}
	async init(config: IAliyunConfig): Promise<void> {
		this.validateConfig(config)
		this.config = config
		this.context = { ...config.context, attributes: { ...config.context?.attributes } }
		const settings = createAliyunSettings(config)
		this.arms = new ArmsRum({
			...settings,
			user: { id: config.context?.userId ?? "" },
			properties: {
				...config.context?.attributes,
				app_session_id: config.context?.sessionId ?? "",
			},
			beforeReport: (bundle) => {
				if (!this.isStarted) return undefined
				// ARMS 0.0.x ignores config.user.id when assembling bundles. Map the
				// application identity here; logout restores the SDK's anonymous identity.
				return {
					...bundle,
					user: {
						...bundle.user,
						...(this.context.userId ? { id: this.context.userId } : {}),
					},
				}
			},
		})
		this.isInitialized = true
	}
	start(): void {
		if (this.isInitialized) this.isStarted = true
	}
	stop(): void {
		this.isStarted = false
	}
	updateContext(context: ApmContext): void {
		this.context = { ...context, attributes: { ...context.attributes } }
		this.arms?.setConfig("user", { id: context.userId ?? "" })
		this.arms?.setConfig("properties", {
			...context.attributes,
			app_session_id: context.sessionId ?? "",
		})
	}
	dispose(): void {
		this.stop()
		// ARMS exposes collector cleanup but no SDK-wide destroy method.
		this.arms?.client.getCollectors().forEach((collector) => collector.destroy?.())
		this.arms = null
		this.context = {}
	}
}

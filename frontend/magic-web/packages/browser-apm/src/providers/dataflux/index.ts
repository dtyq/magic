// Optional peer SDK; only loaded when this Provider is selected.
import { datafluxRum } from "@cloudcare/browser-rum"
import type { IDataFluxConfig } from "../legacy-config"
import { BaseProvider } from "../../core/base-provider"
import type { ApmContext } from "../../core/types"
import { createDataFluxSettings } from "./settings"

export class DataFluxProvider extends BaseProvider {
	private sampleRate = 100
	async init(config: IDataFluxConfig): Promise<void> {
		this.validateConfig(config)
		this.config = config
		const settings = createDataFluxSettings(config)
		this.sampleRate = settings.sessionSampleRate
		// Populate the pre-init SDK context so its first automatic view has the same identity.
		this.updateContext(config.context ?? {})
		datafluxRum.init({ ...settings, sessionSampleRate: 0 })
		this.isInitialized = true
	}
	start(): void {
		if (!this.isInitialized || this.isStarted) return
		this.isStarted = true
		datafluxRum.startSession({ sessionSampleRate: this.sampleRate })
	}
	stop(): void {
		if (!this.isInitialized) return
		this.isStarted = false
		// The SDK has no public destroy. A zero-rate session also covers automatic renewals,
		// unlike beforeSend(false), which cannot suppress DataFlux view events.
		datafluxRum.startSession({ sessionSampleRate: 0 })
		datafluxRum.stopSession()
	}
	updateContext(context: ApmContext): void {
		if (context.userId) datafluxRum.setUser({ id: context.userId })
		else datafluxRum.clearUser()
		datafluxRum.setGlobalContext({
			...context.attributes,
			app_session_id: context.sessionId ?? "",
		})
	}
	dispose(): void {
		this.stop()
		this.updateContext({})
	}
}

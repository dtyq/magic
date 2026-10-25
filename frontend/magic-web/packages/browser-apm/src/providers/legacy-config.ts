import type { IProviderConfig } from "../core/types"
import type { BrowserInitConfig } from "@apmplus/web"

export interface VolcengineOptions {
	plugins?: BrowserInitConfig["plugins"]
	sample?: Partial<NonNullable<BrowserInitConfig["sample"]>>
	/** Compatibility alias for SDK sample.sample_rate (0..1). */
	sampleRate?: number
	useLocalConfig?: boolean
	domain?: string
	errorDedupeWindowMs?: number
	enablePerformance?: boolean
	enableError?: boolean
}

/**
 * Volcengine APMPlus-specific configuration.
 */
export interface IVolcengineConfig extends IProviderConfig, VolcengineOptions {
	type: "Volcengine"
	/** Application ID. */
	aid?: number
	extra?: VolcengineOptions
	/** Whether to enable performance monitoring. */
	enablePerformance?: boolean
	/** Whether to enable error monitoring. */
	enableError?: boolean
}

/**
 * Aliyun ARMS RUM-specific configuration.
 */
export interface IAliyunConfig extends IProviderConfig {
	type: "Aliyun"
	/** Site ID (project ID). */
	pid?: string
	/** RUM reporting endpoint. */
	endpoint?: string
	/** Application version. */
	version?: string
	/** Whether to monitor SPA route changes. */
	enableSPA?: boolean
	/** Whether to report resource loading information. */
	sendResource?: boolean
	/** Resource type tag. */
	tag?: string
}

/**
 * DataFlux Browser RUM-specific configuration.
 * The site must be configured explicitly to avoid sending data to the wrong DataFlux cluster.
 */
export interface IDataFluxConfig extends IProviderConfig {
	type: "DataFlux"
	/** DataFlux RUM endpoint. */
	site?: string
	/** Service name. */
	service?: string
	/** Application version. */
	version?: string
	/** Session sampling rate. */
	sessionSampleRate?: number
	/** Session replay sampling rate. */
	sessionReplaySampleRate?: number
	/** Whether to collect user interactions. */
	trackUserInteractions?: boolean
	/** Whether to collect resource loading events. */
	trackResources?: boolean
	/** Whether to collect long tasks. */
	trackLongTasks?: boolean
	/** Whether to start session replay recording immediately after initialization. */
	startSessionReplayRecording?: boolean
	/** Default privacy level. */
	defaultPrivacyLevel?: "allow" | "mask" | "mask-user-input"
}

/**
 * Provider configuration union.
 */
export type ProviderConfig = IVolcengineConfig | IAliyunConfig | IDataFluxConfig

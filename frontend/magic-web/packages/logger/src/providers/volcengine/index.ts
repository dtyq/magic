import { BaseProvider } from "../../core/base-provider"
import type { IVolcengineConfig } from "../../config/types"
import type { BrowserCommandClient, BrowserInitConfig } from "@apmplus/web"
import browserClient from "@apmplus/web"
import { SPALoadPlugin } from "@apmplus/integrations"
import { blankScreenPlugin } from "@apmplus/integrations/blankScreen"
import { plugin as jsErrorPlugin } from "./plugins/JSErrorPlugin"
import { plugin as pageViewPlugin } from "./plugins/PageViewPlugin"
import { env } from "@/utils/env"
import { cloneDeep, pickBy, pick, isNil } from "lodash-es"
import { SensitiveMasker } from "../../SensitiveMasker"
import { plugin as fetchErrorPlugin } from "./plugins/FetchError"

/**
 * 火山引擎 APMPlus Provider 实现
 * 基于 @apmplus/web SDK
 */
export class VolcengineProvider extends BaseProvider {
	private client: BrowserCommandClient = browserClient

	async init(config: IVolcengineConfig): Promise<void> {
		this.validateConfig(config)
		this.config = config

		// 动态导入火山引擎 SDK
		// const { default: browserClient } = await import("@apmplus/web")

		this.client = browserClient

		// 初始化 APMPlus SDK
		this.client("init", {
			aid: +config.appId,
			token: config.token,
			env: config.env || "production",
			release: env("MAGIC_APP_VERSION") || env("MAGIC_APP_SHA"),
			// plugins: config.plugins || [],
			// ...config.extra,
			plugins: {
				jsError: jsErrorPlugin(),
				pageview: pageViewPlugin(),
				breadcrumb: {
					dom: false,
					maxBreadcrumbs: 20,
				},
				// resource: false,
				resource: {
					ignoreTypes: ["css"],
				},
				ajax: {
					autoWrap: true,
					collectBodyOnError: true,
				},
				fetch: {
					autoWrap: true,
					collectBodyOnError: true,
				},
				performance: {},
				fmp: {
					renderType: "SSR",
				},
				blankScreen: {
					rootSelector: "#root",
					mask: true,
					// 自动上报白屏事件
					autoDetect: true,
				},
			},
			integrations: [SPALoadPlugin(), blankScreenPlugin(), fetchErrorPlugin()],

			// 	aid: number; // 项目唯一标识，必传
			// 	token: string; // 项目 token，必传
			// 	// 通用事件上下文
			// 	pid?: string;
			// 	userId?: string; // 不传时将会生成uuid作为userId。（请勿显示传入undefined,显示传入undefined代表不传userId并拒绝生成uuid，所有上传请求中将不包含userId）
			// 	deviceId?: string; // 不传时将会生成uuid作为deviceId。如果业务自行传入请确保传入值尽量不含特殊字符。（可含有点，斜杠，横杠，下划线，逗号）。（请勿显示传入undefined,显示传入undefined代表不传deviceId并拒绝生成uuid，所有上传请求中不包含deviceId）
			// 	release?: string; // 用于区分不同版本。如果传入，请确保传入值长度小于17且尽量不含特殊字符。（可含有点，斜杠，横杠，下划线，逗号）
			// 	env?: string; // 用于区分不同环境。如果传入，请确保传入值尽量不含特殊字符。（可含有点，斜杠，横杠，下划线，逗号）
			// 	useLocalConfig?: boolean; // 是否只使用本地配置，默认为关
			// 	storageExpires?: number | boolean;// 配置 storage 的过期时间，默认为 90 天
			//
			// 	// 采样配置 和 插件配置 的具体配置可在详细配置中查看
			// 	sample?: SampleConfig; // 采样配置
			// 	plugins?: { ... }; // 具体可以查看 【配置插件】
			//
			// 	// 特殊配置
			// 	pluginBundle?: {
			// 		name: string;
			// 		plugins: string[];
			// 	}; // 插件打包加载配置，非定制插件不需要配置
			// 	pluginPathPrefix?：string; // 插件加载路径前缀，调试用（比如 http://localhost:8081/cn/plugins）或加载定制插件用
			// domain?: string; // 上报域名。中国发布的应用：上报到中国大陆服务器，域名为https://apmplus.volces.com。海外发布的应用，上报到马来西亚柔佛服务器，域名为https://apmplus.ap-southeast-1.volces.com。如不配置，默认上报到中国大陆服务器。
		} as BrowserInitConfig)

		// this.client("on", "provide", (ev: any): any => {
		// 	if (ev.ev_type === "custom") {
		// 		console.log(" provide ", cloneDeep(ev))
		// 	}
		// 	return ev
		// })
		//
		// this.client("on", "report", (ev: any): any => {
		// 	if (ev.ev_type === "custom") {
		// 		console.log(" report ", cloneDeep(ev))
		// 	}
		// 	return ev
		// })
		//
		// this.client("on", "beforeBuild", (ev: any): any => {
		// 	if (ev.ev_type === "custom") {
		// 		console.log(" beforeBuild ", cloneDeep(ev))
		// 	}
		// 	return ev
		// })
		//
		// this.client("on", "build", (ev: any): any => {
		// 	if (ev.ev_type === "custom") {
		// 		console.log(" build ", cloneDeep(ev))
		// 	}
		// 	return ev
		// })

		// 业务状态码异常监控（无侵入式）
		// this.client("on", "report", (ev: any): any => {
		// 	try {
		// 		console.log(ev)
		// 		// 仅处理 fetch/xhr 请求事件
		// 		if (ev.ev_type === "http") {
		// 			const responseBody = ev.response_body
		// 			// 尝试解析响应体中的业务状态码
		// 			if (responseBody && typeof responseBody === "string") {
		// 				try {
		// 					const businessResponse = JSON.parse(responseBody)
		// 					const businessCode = businessResponse?.code
		// 					const businessMessage = businessResponse?.message

		// 					// 业务成功状态码为 1000，其他均为异常
		// 					if (businessCode !== undefined && businessCode !== 1000) {
		// 						// 异步上报业务异常事件，避免阻塞
		// 						setTimeout(() => {
		// 							this.client("sendEvent", {
		// 								name: "business_api_error",
		// 								metrics: {
		// 									business_code: businessCode,
		// 									http_status: ev.status || 0,
		// 									duration: ev.duration || 0,
		// 								},
		// 								categories: {
		// 									url: ev.url || "",
		// 									method: ev.method || "",
		// 									business_message: businessMessage || "",
		// 									request_id: ev.request_id || "",
		// 								},
		// 							})
		// 						}, 0)

		// 						console.warn(
		// 							`[Business API Error] Code: ${businessCode}, Message: ${businessMessage}, URL: ${ev.url}`,
		// 						)
		// 					}
		// 				} catch (parseError) {
		// 					// 响应体非 JSON，忽略
		// 				}
		// 			}
		// 		}
		// 	} catch (error) {
		// 		console.error("Business code monitoring error:", error)
		// 	}
		// 	return ev
		// })

		this.client("on", "beforeSend", (ev: any): any => {
			if (ev.ev_type === "custom") {
				console.log(" beforeSend ", cloneDeep(ev))
			}
			return SensitiveMasker.sanitize(ev)
		})

		// this.client("on", "send", (ev: any): any => {
		// 	console.log(" send ", cloneDeep(SensitiveMasker.sanitize(ev)))
		// 	// 脱敏
		// 	return SensitiveMasker.sanitize(ev)
		// })

		this.isInitialized = true
	}

	start(): void {
		if (!this.isInitialized) {
			throw new Error("Provider not initialized")
		}

		if (!this.client) {
			throw new Error("APMPlus client not initialized")
		}

		// 启动 APMPlus SDK
		this.client("start")
		this.isStarted = true
	}

	stop(): void {
		// 火山引擎 APMPlus 没有直接的 stop 方法
		// 通过标记控制是否上报
		this.isStarted = false
	}

	// "pid" | "userId" | "deviceId" | "sessionId" | "release" | "env"
	setConfig(config: Record<string, string | null | undefined> = {}): void {
		if (!this.client) return
		// 设置配置信息
		this.client(
			"config",
			pickBy(
				pick(config, ["pid", "userId", "deviceId", "sessionId", "release", "env"]),
				(v) => !isNil(v),
			),
		)
	}

	error(error: any): void {
		if (!this.client) return
		// 上报异常信息
		this.client("captureException", error)
	}

	report() {
		if (!this.client) return

		// this.client("sendEvent", {
		// 	name: "custom-metrics",
		// 	metrics: {
		// 		login_count: 1,
		// 		login_api_duration: 1000,
		// 		server_timing: 3456,
		// 		login_level: 23,
		// 	},
		// 	categories: {
		// 		fruit: "apple",
		// 		authorization: "eyJhbGciOiJIUzI1NiIsInR5c775e503447153873a2a682a4d076655fa2064d8c",
		// 		token: "aaaa",
		// 	},
		// })
	}
}

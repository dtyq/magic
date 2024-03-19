// types/env.d.ts
interface ImportMetaEnv {
	/** 当前环境 */
	readonly MAGIC_APP_ENV?: "saas-test" | "saas-pre" | "saas-prod" | "international-prod"
	/** 是否私有化部署 */
	readonly MAGIC_IS_PRIVATE_DEPLOY?: "true" | "false"
	/** WebSocket连接地址 */
	readonly MAGIC_SOCKET_BASE_URL?: string
	/** SSO登录地址 */
	readonly MAGIC_TEAMSHARE_BASE_URL?: string
	/** 后端服务地址 */
	readonly MAGIC_SERVICE_BASE_URL?: string
	/** Keewood 后端服务地址 */
	readonly MAGIC_SERVICE_KEEWOOD_BASE_URL?: string
	/** Teamshare 后端服务地址 */
	readonly MAGIC_SERVICE_TEAMSHARE_BASE_URL?: string
	/** Teamshare 高德地图Key */
	readonly MAGIC_AMAP_KEY?: string
	/** Teamshare 高德地图Secret */
	readonly MAGIC_GATEWAY_ADDRESS?: string
	/** magic 应用 sha */
	readonly MAGIC_APP_SHA?: string
	/** magic 应用 版本 */
	readonly MAGIC_APP_VERSION?: string
	readonly MAGIC_TEAMSHARE_WEB_URL?: string
	readonly MAGIC_KEEWOOD_WEB_URL?: string
	/** 默认语言 */
	readonly MAGIC_DEFAULT_LANGUAGE?: string
	/** 代码版本：商业版：ENTERPRISE | 开源版：COMMUNITY */
	readonly MAGIC_EDITION?: string
	/** 私有化部署备案号 */
	readonly MAGIC_ICP_CODE?: string
	/**
	 * SAAS 登录配置，格式为 JSON 字符串
	 * {
	 * 	wechatOfficialAccountLogin: {
	 * 		enable: boolean
	 * 	},
	 * 	phonePasswordLogin: {
	 * 		enable: boolean
	 * 	}
	 * }
	 */
	readonly MAGIC_LOGIN_CONFIG?: string
	/** 私有化部部署版权信息 */
	readonly MAGIC_COPYRIGHT?: string
	/** 企业版本的订阅套餐的支付方式，可选值：ALIPAY、STRIPE */
	readonly MAGIC_PAYMENT_METHOD?: string
	/** 当前环境对应的 Web 地址 */
	readonly MAGIC_WEB_URL?: string
	/** 钉钉 App Key （存在于私有化部署配置中） */
	readonly MAGIC_DINGTALK_APP_KEY?: string
	/** 钉钉 App Redirect URI（存在于私有化部署配置中） */
	readonly MAGIC_DINGTALK_REDIRECT_URI?: string
	/** 私有化部署中第三方登录配置 */
	readonly MAGIC_PRIVATE_DEPLOYMENT_CONFIG?: string
	/** 公共 CDN 地址 */
	readonly MAGIC_PUBLIC_CDN_URL?: string
	/** CDN 资源地址 */
	readonly MAGIC_CDNHOST?: string
	/** 云服务商“应用性能全链路监控” */
	readonly MAGIC_APM?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

interface Window {
	CONFIG: ImportMetaEnv
}

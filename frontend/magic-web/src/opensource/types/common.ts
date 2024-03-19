import type { Login } from "@/opensource/types/login"

export namespace Common {
	export interface InternationalizedSettingsResponse {
		languages: Array<{
			name: string
			locale: string
			translations: Record<string, string>
		}>
		phone_area_codes: Array<{
			code: string
			name: string
			locale: string
			translations: Record<string, string>
		}>
	}

	/** 私有化登录 - 第三方登录数据（静默登录、扫码登录） */
	export interface PrivateConfigSignInValues {
		enable: boolean
		/** App Id */
		appId?: string
		/** App Key */
		appKey?: string
		/** 重定向地址 */
		redirectUrl?: string
		/** 钉钉组织ID */
		corpId?: string
		/** 企业微信特有id配置 */
		agentId?: string
		/** 是否默认登录方式 */
		default?: boolean
	}

	/** 私有化登录 - 服务配置 */
	interface ServiceConfig {
		/** 服务地址 */
		url?: string
	}

	type MagicAppKeyConfig = {
		type: "dingtalk"
		appkey: string
		callback: string
		qrcode: string
	}

	/** 私有化部署配置 */
	export interface PrivateConfig {
		/** 私有化部署组织代码 */
		orgcode: string
		/** 私有化部署专属码 */
		deployCode: string
		/** 当前环境名称 */
		name?: string
		/** 微应用/微服务（teamshare、keewood、magic等服务中http、websocket等配置） */
		services: Record<string, ServiceConfig>
		/** 第三方登录 */
		loginConfig?: Record<Login.LoginType, PrivateConfigSignInValues>
		/** 钉钉 App 登录配置 */
		magic_app?: {
			keyconfig: MagicAppKeyConfig[]
		}
	}

	export interface IAMConfig {
		enable?: boolean
		organizationCode?: string
		app_id?: string
		redirect_url?: string
		name_zh?: string
		name_en?: string
	}

	/** 私有化部署配置 */
	export interface PrivateDeploymentConfig {
		enable: boolean
		defaultIAM: Login.LoginType
		iam: Record<Login.LoginType, IAMConfig>
	}

	export interface DeviceInfo {
		id: string
		name: string
		os: string
		os_version: string
	}
}

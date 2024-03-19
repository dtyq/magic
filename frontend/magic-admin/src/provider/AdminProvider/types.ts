import type { HttpClient } from "@/apis/core/HttpClient"
import type { LanguageType } from "components"
import type { NavigateProps } from "react-router"
import type { LocaleType } from "../../../components/locales"

export const enum AppEnv {
	/** 生产环境 */
	Production = "saas-prod",
	/** 预发布环境 */
	Pre = "saas-pre",
	/** 测试环境 */
	Test = "saas-test",
	/** 预发布国际环境 */
	InternationalPre = "international-pre",
	/** 国际版 生产环境 */
	InternationalProduction = "international-prod",
}

/** 全局国际冠号选项 */
export interface AreaCodeOption {
	/** 当前语言标识 */
	locale: string
	/** 当前冠号识别号 */
	code: string
	/** 当前语言名称 */
	name: string
	/** 用于当前语言的枚举各语言的表达 */
	translations: Record<string, string>
}

/** 用户信息 */
export interface UserInfo {
	// teamshare 用户id
	id?: string
	// Magic 用户id
	magic_id: string
	user_id: string
	status: string | number
	nickname: string
	real_name: string
	avatar: string
	organization_code: string
	phone?: string
	email?: string
	country_code?: string
}

/** Teamshare 用户信息 */
export interface TeamshareUserInfo {
	id: string
	name: string
	avatar: string
	departments: {
		name: string
		id: string
	}[][]
}

/**
 * API 客户端配置
 */
export interface ApiClients {
	/** Magic 服务请求实例 */
	magicClient: HttpClient
}

export interface Services {
	base_url: string
	teamshare_base_url: string
	keewood_base_url: string
}

/**
 * i18n 实例类型定义
 * 用于与 magic 项目共享国际化实例
 */
export interface I18nInstance {
	/** 当前语言 */
	language: string
	/** 切换语言 */
	changeLanguage: (lng: string) => Promise<void>
	/** 翻译函数 */
	t: (key: string, options?: any) => string
	/** 是否已初始化 */
	isInitialized: boolean
	/** 添加资源包 */
	addResourceBundle: (
		lng: string,
		ns: string,
		resources: any,
		deep?: boolean,
		overwrite?: boolean,
	) => void
	/** 加载命名空间 */
	loadNamespaces: (ns: string | string[]) => Promise<void>
}

export interface RouteParams {
	/** 路由别名 */
	name: string
	/** 路径参数 */
	params?: Record<string, string | number | undefined>
	/** 查询参数 */
	query?: Record<string, string | number>
	state?: any
	/** 集群编码 */
	// clusterCode?: string
}

/**
 * View Transition 动画类型
 */
export type ViewTransitionType = "fade" | "slide" | "scale" | "flip" | "custom"

/**
 * 滑动方向
 */
export type ViewTransitionDirection = "left" | "right" | "up" | "down"

/**
 * View Transition 配置选项
 */
export interface ViewTransitionConfig {
	/** 是否启用 View Transition */
	enabled?: boolean
	/** 过渡动画类型 */
	type?: ViewTransitionType
	/** 滑动方向（当 type 为 'slide' 时有效） */
	direction?: ViewTransitionDirection
	/** 动画持续时间（毫秒） */
	duration?: number
	/** 缓动函数 */
	easing?: string
	/** View Transition 名称（用于 CSS 选择器） */
	name?: string
	/** 降级回调函数（当浏览器不支持时调用） */
	fallback?: () => void
	/** 动画开始前的回调 */
	onStart?: () => void
	/** 动画完成后的回调 */
	onComplete?: () => void
	/** 动画被跳过时的回调 */
	onSkip?: () => void
}

/**
 * 扩展的导航选项，包含 View Transition 支持
 */
export interface EnhancedNavigateOptions {
	/** React Router 原生选项 */
	replace?: boolean
	state?: any
	relative?: "route" | "path"
	preventScrollReset?: boolean
	/** View Transition 配置 */
	viewTransition?: boolean | ViewTransitionConfig
}

/**
 * 增强的导航函数类型
 * 支持通过路由名称或路径导航
 */
export type EnhancedNavigateFunction = Partial<RouteParams> &
	EnhancedNavigateOptions & {
		/** history.go */
		delta?: number
	}

export interface MagicOrganization {
	id?: string
	/** magic 用户UnionID（整个magic生态下唯一） */
	magic_id: string
	/** magic 组织编码 */
	magic_organization_code: string
	/** magic 用户OpenId（当前组织下唯一） */
	magic_user_id: string
	/** 组织Logo */
	organization_name: string
	/** 组织名称 */
	organization_logo: string | null
	/** 第三方平台 组织编码 */
	third_platform_organization_code: string
	/** 第三方平台 用户Id */
	third_platform_user_id: string
	/** 第三方平台类型 */
	third_platform_type: string | null
	[key: string]: any
}

/** Teamshare 账号组织 */
export interface TeamshareOrganization {
	id: string
	member_id: string
	platform_type: number
	real_name: string
	avatar: string
	organization_code: string
	organization_name: string
	organization_logo: {
		url: string
		key: string
		name: string
		uid: string
	}[]
	is_admin: boolean
	is_application_admin: boolean
	is_complete_info: boolean
	state_code: string
	identifications: string[]
	creator_id: string
	is_personal_organization: boolean
	active_count: number
}

export interface Organization {
	organizationCode: string
	teamshareOrganizationCode?: string
	organizationInfo: MagicOrganization | null
	teamshareOrganizationInfo?: TeamshareOrganization | null
}

/**
 * 管理后台桥接配置
 * 用于从 magic 项目注入依赖
 */
export interface AdminBridgeConfig {
	/** API 客户端实例（与 magic 共享） */
	apiClients: ApiClients
	/** 环境变量 */
	env: {
		MAGIC_APP_ENV: AppEnv
		MAGIC_BASE_URL: string
	}
	/** 用户信息 （与 magic 共享 */
	user: {
		/** 用户Token（与 magic 共享） */
		token: string | null
		/** 用户信息 （与 magic 共享 */
		userInfo: UserInfo | null
		/** Teamshare 用户信息 （与 magic 共享 */
		teamshareUserInfo: TeamshareUserInfo | null
	}
	/** 当前账户所处的组织信息 （与 magic 共享 */
	organization: Organization
	/** 路由导航函数（与 magic 共享） */
	navigate: (props: EnhancedNavigateFunction) => void
	/** 路由导航组件 */
	Navigate?: React.ComponentType<NavigateProps>
	/** 基础路径前缀，默认 /admin */
	basePath?: string
	/** 集群编码 */
	clusterCode?: string
	/** 是否是个人组织 */
	isPersonalOrganization?: boolean
	/** 全局国际冠号选项 */
	areaCodes?: AreaCodeOption[] | null
	/** 是否是私有部署 */
	isPrivateDeployment?: boolean
	/** 安全区域间距 */
	safeAreaInset?: {
		bottom?: number | string
		top?: number | string
	}
	/** 其他自定义配置 */
	[key: string]: any
}

export interface AdminProviderProps extends AdminBridgeConfig {
	/** 主题 */
	theme?: "light" | "dark"
	/** 语言 */
	language?: LanguageType
}

export interface AdminProviderContextType extends AdminProviderProps {
	getLocale: <T extends keyof LocaleType>(namespace: T) => LocaleType[T]
}

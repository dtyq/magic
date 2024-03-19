import type { ReactNode } from "react"
import { LoginDeployment } from "@/opensource/pages/login/constants"
import type { getDeviceInfo } from "@/opensource/utils/devices"

export interface LoginPanelFormStorage {
	[key: string]: any
}

export interface LoginPanelProps {
	/** 是否为默认登录方式 */
	isDefaultLoginType?: boolean
	/** 设置登录方式 */
	setLoginType?: (loginType: Login.LoginType) => void
	/** 设置登录环境 */
	setDeployment?: (deployment: LoginDeployment) => void
	/** 底部内容 */
	footer?: ReactNode
	/** 设置上一步 */
	setPrevStep?: () => void
	/** 登录异常回调 */
	onError?: (...args: Array<any>) => void
	/** 表单存储 */
	formStorage?: LoginPanelFormStorage
	/** 表单存储变化回调 */
	onFormStorageChange?: (storage: LoginPanelFormStorage) => void
	/** 打开 popup 窗口登录 */
	openPopupLogin?: (popupUrl: string) => void
}

export namespace Login {
	/** 登录方式(与API强绑定，禁止修改) */
	export enum LoginType {
		/** 短信验证码登录 */
		SMSVerificationCode = "phone_captcha",
		/** 邮箱验证码登录 */
		EmailVerificationCode = "email",
		/** 手机号+密码登录 */
		MobilePhonePassword = "phone_password",
		/** 账号密码登录 */
		// AccountPassword = "username",
		/** 钉钉 */
		DingTalk = "DingTalk",
		/** 钉钉扫码登录 */
		DingTalkScanCode = "DingTalk",
		/** 钉钉免登 */
		DingTalkAvoid = "DingTalkAvoid",
		/** 企业微信 */
		WecomScanCode = "wecom",
		/** 飞书 */
		LarkScanCode = "Lark",
		/** 飞书免登 */
		LarkAvoid = "Lark",
		/** 飞书跳转登录 */
		LarkRedirect = "LarkRedirect",
		/** 微信公众号登录 */
		WechatOfficialAccount = "wechat_official_account",
		/** App客户端下 - 微信登录 */
		WechatAppLogin = "wechat_app",
		/** App客户端下 - 钉钉登录 */
		DingTalkAppLogin = "dingtalk_app",
		/** 跳转登录 */
		Redirect = "redirect",
		/** Apple登录 */
		AppleLogin = "apple_login",
		/** Google登录 */
		GoogleLogin = "google_login",
	}

	/** 登录响应（验证码、手机号+密码、钉钉、飞书、企业微信等登录方式） */
	export interface UserLoginsResponse {
		access_token: string
		bind_phone: boolean
		is_perfect_password: boolean
		user_info: {
			avatar: string
			description: string
			id: string
			mobile: string
			position: string
			real_name: string
			state_code: string
		}
	}

	/** 通用登录表单数据类型 */
	interface LoginFormCommonValues {
		device?: Awaited<ReturnType<typeof getDeviceInfo>>
		redirect: string
		/** 邀请码 */
		invite_code?: string
	}

	/** 验证码登录表单 */
	export interface SMSVerificationCodeFormValues extends LoginFormCommonValues {
		type: Login.LoginType
		/** 手机号 */
		phone: string
		/** 国家区号 */
		state_code: string
		/** 验证码 */
		code: string
		/** 是否自动注册 */
		auto_register: boolean
	}

	/** 邮箱验证码登录表单 */
	export interface EmailVerificationCodeFormValues extends LoginFormCommonValues {
		type: Login.LoginType
		/** email */
		email: string
		/** 验证码 */
		captcha: string
		/** 自动注册 */
		auto_register: boolean
	}

	/** 手机号码+密码 */
	export interface MobilePhonePasswordFormValues extends LoginFormCommonValues {
		type: Login.LoginType
		/** 手机号 */
		phone: string
		/** 国家区号 */
		state_code: string
		/** 密码 */
		password: string
	}

	/** 钉钉扫码登录 */
	export interface ThirdPartyLoginsFormValues extends LoginFormCommonValues {
		/** 第三方登录平台（Omit<Login.LoginType, "SMSVerificationCode" | "MobilePhonePassword">） */
		platform_type: Login.LoginType
		/** 第三方平台临时授权Code */
		authorization_code: string
	}

	/** 公众号扫码登录 */
	export interface WechatOfficialAccountLoginsFormValues extends Omit<
		LoginFormCommonValues,
		"redirect"
	> {
		/** 第三方登录平台（Omit<Login.LoginType, "SMSVerificationCode" | "MobilePhonePassword">） */
		platform_type: Login.LoginType.WechatOfficialAccount
		/** 第三方平台临时授权Code */
		authorization_code: string
		/** 场景值 */
		scene_value: string
	}

	/** App客户端下 - 微信登录 */
	export interface WechatAppLoginsFormValues extends Omit<LoginFormCommonValues, "redirect"> {
		platform_type: Login.LoginType.WechatAppLogin
		/** 第三方平台临时授权Code */
		authorization_code: string
	}

	/** App客户端下 - 钉钉登录 */
	export interface DingTalkAppLoginFormValues extends Omit<LoginFormCommonValues, "redirect"> {
		platform_type: Login.LoginType.DingTalk
		/** 第三方平台临时授权Code */
		authorization_code: string
	}

	export interface AppleLoginFormValues extends LoginFormCommonValues {}

	export interface GoogleLoginFormValues extends LoginFormCommonValues {}

	export interface LarkRedirectFormValues extends LoginFormCommonValues {}

	export interface RedirectFormValues extends LoginFormCommonValues {}

	/**  图片验证码账号类型 */
	export type AccountParams =
		| { email: string; mobile?: never; state_code?: never }
		| { email?: never; mobile: string; state_code: string }

	/** 生成图片验证码参数 */
	export type ImageCaptchaParams = {
		account_type?: "email" | "mobile"
		scenario?: "default" | "login" | "register" | "sensitive_operation"
	} & AccountParams

	/** 已注册  */
	export type RegisteredImageCaptcha = { business_token: string; expires_in: number }
	/** 未注册 */
	export type UnregisteredImageCaptcha = { token: string; image: string; expire_time: Date }

	/** 生成图片验证码响应 */
	export type ImageCaptchaResponse = RegisteredImageCaptcha | UnregisteredImageCaptcha

	/** 验证图片验证码参数 */
	export type VerifyImageCaptchaParams = {
		account_type?: "email" | "mobile"
		token: string
		angle: string
	} & AccountParams

	/** 验证图片验证码响应 */
	export type VerifyImageCaptchaResponse = {
		verified: boolean
		business_token: string
		expire_in: string
	}
}

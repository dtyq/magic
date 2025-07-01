import { LoginDeployment } from "@/opensource/pages/login/constants"
import type { getDeviceInfo } from "@/utils/devices"
import type { FormInstance } from "antd"

export interface LoginPanelProps<V> {
	form?: FormInstance<V>
	/** 下一步之前 */
	nextStepBefore?: () => Promise<void>
	/** 是否禁用 */
	disabled?: boolean
	/** 设置登录方式 */
	setLoginType?: (loginType: Login.LoginType) => void
	/** 设置登录环境 */
	setDeployment?: (deployment: LoginDeployment) => void
	/** 是否显示下一步 */
	nextStep?: boolean
	/** 设置是否显示下一步 */
	setNextStep?: (nextStep: boolean) => void
}

export namespace Login {
	/** 登录方式(与API强绑定，禁止修改) */
	export enum LoginType {
		/** 短信验证码登录 */
		SMSVerificationCode = "phone_captcha",
		/** 手机号+密码登录 */
		MobilePhonePassword = "phone_password",
		/** 账号密码登录 */
		// AccountPassword = "username",
		/** 钉钉扫码登录 */
		DingTalkScanCode = "DingTalk",
		/** 钉钉免登 */
		DingTalkAvoid = "DingTalkAvoid",
		/** 企业微信 */
		WecomScanCode = "WeCom",
		/** 飞书 */
		LarkScanCode = "Lark",
		/** 飞书免登 */
		LarkAvoid = "Lark",
		/** 微信公众号登录 */
		WechatOfficialAccount = "wechat_official_account",
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

	/** 公众号登录 */
	export interface WechatOfficialAccountLoginsFormValues
		extends Omit<LoginFormCommonValues, "redirect"> {
		/** 第三方登录平台（Omit<Login.LoginType, "SMSVerificationCode" | "MobilePhonePassword">） */
		platform_type: Login.LoginType.WechatOfficialAccount
		/** 第三方平台临时授权Code */
		authorization_code: string
		/** 场景值 */
		scene_value: string
	}
}

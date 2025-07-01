import type { Login } from "@/types/login"
import type { User } from "@/types/user"

// 登录方式与表单映射关系
export type LoginFormValuesMap = {
	[Login.LoginType.SMSVerificationCode]: Login.SMSVerificationCodeFormValues
	[Login.LoginType.MobilePhonePassword]: Login.MobilePhonePasswordFormValues
	[Login.LoginType.DingTalkScanCode]: Login.ThirdPartyLoginsFormValues
	[Login.LoginType.DingTalkAvoid]: Login.ThirdPartyLoginsFormValues
	[Login.LoginType.LarkScanCode]: Login.ThirdPartyLoginsFormValues
	[Login.LoginType.WecomScanCode]: Login.ThirdPartyLoginsFormValues
	[Login.LoginType.WechatOfficialAccount]: Login.WechatOfficialAccountLoginsFormValues
}

/**
 * 登录提交函数
 */
export type OnSubmitFn<T extends Login.LoginType> = (
	type: T,
	values: LoginFormValuesMap[T],
	overrides?: {
		loginStep?: () => Promise<Login.UserLoginsResponse>
	},
) => void

export interface LoginStepResult {
	access_token: string
	magicOrganizationMap: Record<string, User.MagicOrganization>
	organizations?: Array<User.UserOrganization>
	/** magic 生态下的组织Code */
	organizationCode?: string
	/** teamshare 生态下的组织Code */
	teamshareOrganizationCode?: string
	deployCode?: string
}

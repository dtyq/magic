/**
 * 验证码类型
 */
export const enum VerificationCode {
	/** 修改密码 */
	ChangePassword = "change_password",
	/** 修改手机 */
	ChangePhone = "change_phone",
	/** 绑定手机 */
	BindPhone = "bind_phone",
	/** 账号注册 */
	RegisterAccount = "register_account",
	/** 账号登录激活 */
	AccountLoginActive = "account_login_active",
	/** 账号注册激活 */
	AccountRegisterActive = "account_register_active",
	/** 账号登录 */
	AccountLogin = "account_login",
	/** 账号登录绑定第三方平台 */
	AccountLoginBindThirdPlatform = "account_login_bind_third_platform",
	/** 设备登出 */
	DeviceLogout = "device_logout",
}

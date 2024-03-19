export const enum UserMenuKey {
	/** 切换语言 */
	SwitchLanguage = "switchLanguage",
	/** 账户管理 */
	AccountManagement = "accountManagement",
	/** 设备管理
	 * @deprecated
	 * @see UserMenuKey.Preferences
	 */
	DeviceManagement = "deviceManagement",
	/** 设置
	 * @deprecated
	 * @see UserMenuKey.Preferences
	 */
	Settings = "settings",
	/** 问题反馈 */
	OnlineFeedback = "onlineFeedback",
	/** 退出登录 */
	Logout = "logout",
	/** 管理后台 */
	Admin = "admin",
	/* 用户账户 */
	UserAccount = "userAccount",
	/** 偏好设置 */
	Preferences = "preferences",
	/** 分享管理 */
	ShareManagement = "shareManagement",
	/** 定时任务 */
	ScheduledTasks = "scheduledTasks",
	/** 长期记忆 */
	LongTermMemory = "longTermMemory",
	/** 消费/积分明细 */
	ConsumptionDetails = "consumptionDetails",
	/** 下载客户端 */
	DownloadClient = "downloadClient",
}

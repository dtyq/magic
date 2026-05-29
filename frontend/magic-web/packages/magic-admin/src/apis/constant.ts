/* eslint-disable no-template-curly-in-string */

export const RequestUrl = {

	/** 获取组织架构 */
	getOrganization: "/api/v1/contact/departments/${id}/children",
	/** 【新版本】获取部门用户列表 */
	getDepartmentUsers: "/api/v1/contact/departments/${id}/users",
	/** 搜索用户 */
	searchUser: "/api/v2/magic/contact/user/searchForSelect",

	/** 获取天书组织架构 */
	getTeamshareOrganization: "api/organization/chart/queries",
	/** 获取子管理员权限列表 */
	getSubAdminPermissions: "/v4/console/sub-admin/permissions",
	/** 获取组织当前订阅的套餐 */
	getSubscriptionInfo: "/api/v1/admin/subscription",

	/** AI管理 */
	/** AI管理 - 模型管理 */
	/** 获取服务提供商（非官方数据） */
	getServiceProvider: "/api/v1/admin/service-providers/templates/queries",
	/** 非官方组织获取服务提供商 */
	getServiceProviderNonOfficial: "/api/v1/organization/admin/service-providers/templates/queries",
	/** 官方组织获取服务商列表 */
	getServiceProviderList: "/api/v1/admin/service-providers",
	/** 非官方组织获取服务商列表 */
	getServiceProviderListNonOfficial: "/api/v1/organization/admin/service-providers",
	/** 获取服务商详细信息 */
	getServiceProviderDetail: "/api/v1/admin/service-providers/${id}",
	/** 非官方组织获取服务商详细信息 */
	getServiceProviderDetailNonOfficial: "/api/v1/organization/admin/service-providers/${id}",
	/** 获取服务商模型价格模板 */
	getModelPricingTemplates: "/api/v1/admin/service-providers/model-pricing-templates/queries",

	/** 激活/取消模型 */
	updateModelStatus: "/api/v1/admin/service-providers/models/${id}/status",
	/** 非官方组织激活/取消模型 */
	updateModelStatusNonOfficial:
		"/api/v1/organization/admin/service-providers/models/${id}/status",
	/** 添加模型 */
	addModel: "/api/v1/admin/service-providers/models",
	/** 非官方组织添加模型 */
	addModelNonOfficial: "/api/v1/organization/admin/service-providers/models",
	/** 删除模型 */
	deleteModel: "/api/v1/admin/service-providers/models/${id}",
	/** 非官方组织删除模型 */
	deleteModelNonOfficial: "/api/v1/organization/admin/service-providers/models/${id}",
	/** 连通性测试 */
	testConnection: "/api/v1/admin/service-providers/connectivity-test",
	/** 非官方组织连通性测试 */
	testConnectionNonOfficial: "/api/v1/organization/admin/service-providers/connectivity-test",

	/** 获取模型标识列表 */
	getOriginalModelList: "/api/v1/admin/service-providers/original-models",
	/** 非官方组织获取原始模型列表 */
	getOriginalModelListNonOfficial: "/api/v1/organization/admin/service-providers/original-models",
	/** 删除模型标识 */
	deleteModalId: "/api/v1/admin/service-providers/model-ids/${id}",
	/** 非官方组织删除模型标识 */
	deleteModalIdNonOfficial: "/api/v1/organization/admin/service-providers/model-ids/${id}",
	/** 添加模型标识 */
	addModalId: "/api/v1/admin/service-providers/model-id",
	/** 非官方组织添加模型标识 */
	addModalIdNonOfficial: "/api/v1/organization/admin/service-providers/model-id",
	/** 判断当前组织是否是官方组织 */
	isOfficialOrg: "/api/v1/admin/service-providers/office-info",

	/** 获取默认图标 */
	getDefaultIcon: "/api/v1/file/business-file",
	/** 文件上传 */
	uploadFile: "/api/v1/file/upload-business-file",
	/** 获取上传凭证 */
	getUploadCredentials: "/api/v1/file/temporary-credential",
	/** 删除文件 */
	deleteFile: "/api/v1/file/delete-business-file",
	/** 获取文件临时链接 */
	getFileTemporaryLink: "/api/v1/file-utils/temporary-urls/queries",
	/** 获取官方服务商积分统计 */
	getOfficialPointsStatistics: "/api/v1/quota/points/statistics",
	/** 获取商品列表并携带sku */
	getProductListWithSku: "/api/v1/official/admin/products/details",

	/** 组织后台 - 员工审核列表 */
	getOrganizationAgentVersionReviewList:
		"/api/v1/organization/admin/super-magic/agents/versions/queries",
	/** 组织后台 - 审核员工版本 */
	reviewOrganizationAgentVersion:
		"/api/v1/organization/admin/super-magic/agents/versions/${id}/review",
	/** 组织后台 - Skill 审核列表 */
	getOrganizationSkillVersionReviewList: "/api/v1/organization/admin/skills/versions/queries",
	/** 组织后台 - 审核 Skill 版本 */
	reviewOrganizationSkillVersion: "/api/v1/organization/admin/skills/versions/${id}/review",

	/** AI管理 - 助理管理 */
	/** 获取企业内部助理列表 */
	getAgentList: "/org/admin/agents",
	/** 获取助理详情 */
	updateAgentStatus: "/org/admin/agents/update-status",
	/** 保存助理 */
	saveAgent: "/api/v2/magic/bot/save",
	/** 获取企业内助理创建人 */
	getAgentCreator: "/org/admin/agents/creator",

	/** AI管理 - 功能配置 */
	/** 获取已发布助理列表 */
	getPublishList: "/api/v1/admin/agents/published",
	/** AI助理全局设置 */
	agentGlobalSettings: "/api/v1/admin/globals/agents/settings",

	/** AI管理 - 管控策略 */
	/** 积分组织管控规则 */
	getOrgControlRule: "/api/v1/quota/points/control",
	/** 查询管控目标已用积分 */
	getControlTargetUsedPoints: "/api/v1/quota/points/control/points-used/queries",

	/** 平台管理 */
	/** —————— 平台管理 - 模式管理 —————— */
	/** 获取模式列表 */
	getModeList: "/api/v1/official/admin/modes",
	/** 获取默认模式 */
	getDefaultMode: "/api/v1/official/admin/modes/default",
	/** 获取模式详情 */
	getModeDetail: "/api/v1/official/admin/modes/${id}",
	/** 修改模式状态 */
	updateModeStatus: "/api/v1/official/admin/modes/${id}/status",
	/** 保存模式配置 */
	saveModeConfig: "/api/v1/official/admin/modes/${id}/config",
	/** 获取所有模型列表 */
	getAllModelList: "/api/v1/admin/service-providers/models/queries",
	/** 创建分组 */
	createModeGroup: "/api/v1/official/admin/mode-groups",
	/** 修改分组 */
	updateModeGroup: "/api/v1/official/admin/mode-groups/${id}",
	/** 获取模式原始信息 */
	getModeOriginalInfo: "/api/v1/official/admin/modes/origin/${id}",
	/** —————— 平台管理 - skill及员工管理 —————— */
	/** 员工详情  */
	getAgentDetail: "/api/v2/admin/super-magic/agents/${code}",
	/** 员工审核列表 */
	getAgentVersionReviewList: "/api/v2/admin/super-magic/agents/versions/queries",
	/** 审核员工版本 */
	reviewAgentVersion: "/api/v2/admin/super-magic/agents/versions/${id}/review",
	/** 员工市场列表 */
	getAgentMarketList: "/api/v2/admin/super-magic/agents/markets/queries",
	/** 更新员工市场信息 */
	updateAgentMarketInfo: "/api/v2/admin/super-magic/agents/markets/${id}",
	/** Skill版本列表 */
	getSkillVersionList: "/api/v1/admin/skills/versions/queries",
	/** Skill 市场列表 */
	getSkillMarketList: "/api/v1/admin/skills/markets/queries",
	/** 更新 Skill 市场信息 */
	updateSkillMarketInfo: "/api/v1/admin/skills/markets/${id}",
	/** 审核 Skill 版本 */
	reviewSkillVersion: "/api/v1/admin/skills/versions/${id}/review",
	/** —————— 平台管理 - 能力管理 —————— */
	/** 获取AI能力列表 */
	getAiPowerList: "/api/v1/admin/ai-abilities",
	/** 更改/AI能力详情 */
	updateAiPower: "/api/v1/admin/ai-abilities/${code}",
	/** 能力管理联通性测试  */
	testAiPowerConnection: "/api/v1/admin/ai-abilities/connectivity-test",
	/** 获取全局配置 */
	getGlobalConfig: "/api/v1/settings/global",

	/** 权限 */
	/** 获取我的权限列表 */
	getMyPermissionList: "/api/v1/permissions/me",

	/** 平台信息 */
	/** 获取平台信息 */
	getPlatformInfo: "/api/v1/platform/setting",
	/** 修改平台信息 */
	updatePlatformInfo: "/api/v1/platform/setting",

	/** 应用菜单 */
	/** 分页查询应用菜单列表 */
	getAppMenuList: "/api/v1/admin/applications/queries",
	/** 保存应用菜单（新增/编辑，有 id 则编辑，无 id 则新增） */
	saveAppMenu: "/api/v1/admin/applications/save",
	/** 删除应用菜单 */
	deleteAppMenu: "/api/v1/admin/applications/delete",
	/** 设置应用菜单状态（启用/禁用） */
	updateAppMenuStatus: "/api/v1/admin/applications/status",

	/** File */
	/** 检查文件上传状态 */
	checkFileUploadStatus: "/api/v1/file-utils/upload-verifications",
	/** 上报文件上传 */
	reportFileUpload: "/api/v1/im/files",
	/** 获取文件下载链接 */
	getFileDownloadLink: "/api/v1/file/publicFileDownload",
	/** 获取上传token */
	getUploadToken: "/api/v1/file-utils/upload-token",

	/** 审批 */
	/** 获取审批详情 */
	getApprovalInstance: "/api/oa-approval/instances/${id}",
	/** 获取下一单审批 */
	getNextApproval: "/api/oa-approval/instances/next-pending",
	/** 审批分享 */
	approvalShare: "/api/oa-approval/instances/${id}/share",
	/** 重置审批分享链接 */
	resetShareLink: "/api/oa-approval/instances/${id}/user-share/reset",
	/** 创建审批分享链接 */
	createShareLink: "/api/oa-approval/instances/${id}/user-share",
	/** 通过分享链接获取访问记录 */
	getShareLinkAccessRecord: "/api/oa-approval/instances/${id}/user-share/access-logs",
	/** 获取分享链接 */
	getShareLink: "/api/oa-approval/instances/${id}/user-share",
	/** 激活审批分享链接 */
	activeShareLink: "/api/oa-approval/instances/${id}/user-share/status",
}

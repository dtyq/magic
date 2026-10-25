/* eslint-disable no-template-curly-in-string */

export const RequestUrl = {
	/** 获取组织架构 */
	getOrganization: "/api/v1/contact/departments/${id}/children",
	/** 【新版本】获取部门用户列表 */
	getDepartmentUsers: "/api/v1/contact/departments/${id}/users",
	/** 搜索用户 */
	searchUser: "/api/v2/magic/contact/user/searchForSelect",

	/** AI管理 */
	/** AI管理 - 模型管理 */
	/** 获取服务提供商（非官方数据） */
	getServiceProvider: "/api/v1/admin/service-providers/templates/queries",
	/** 官方组织获取服务商列表 */
	getServiceProviderList: "/api/v1/admin/service-providers",
	/** 获取服务商详细信息 */
	getServiceProviderDetail: "/api/v1/admin/service-providers/${id}",
	/** 获取服务商模型价格模板 */
	getModelPricingTemplates: "/api/v1/admin/service-providers/model-pricing-templates/queries",

	/** 激活/取消模型 */
	updateModelStatus: "/api/v1/admin/service-providers/models/${id}/status",
	/** 添加模型 */
	addModel: "/api/v1/admin/service-providers/models",
	/** 删除模型 */
	deleteModel: "/api/v1/admin/service-providers/models/${id}",
	/** 连通性测试 */
	testConnection: "/api/v1/admin/service-providers/connectivity-test",

	/** 获取模型标识列表 */
	getOriginalModelList: "/api/v1/admin/service-providers/original-models",
	/** 删除模型标识 */
	deleteModalId: "/api/v1/admin/service-providers/model-ids/${id}",
	/** 添加模型标识 */
	addModalId: "/api/v1/admin/service-providers/model-id",
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

	/** 平台管理 */
	/** —————— 平台管理 - 模式管理 —————— */
	/** 获取模式列表 */
	getModeList: "/api/v1/official/admin/modes",
	/** 获取默认模式 */
	getDefaultMode: "/api/v1/official/admin/modes/default",
	/** 获取、更新平台默认数字员工 */
	defaultAgentSetting: "/api/v1/official/admin/mode-settings/default-agent",
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
	/** 更新员工市场分类 */
	updateAgentMarketCategoryRelation: "/api/v2/admin/super-magic/agents/markets/${id}/category",
	/** 员工市场分类列表 */
	getAgentMarketCategoryList: "/api/v2/admin/super-magic/agents/categories/queries",
	/** 员工市场分类详情 */
	getAgentMarketCategoryDetail: "/api/v2/admin/super-magic/agents/categories/${id}",
	/** 创建员工市场分类 */
	createAgentMarketCategory: "/api/v2/admin/super-magic/agents/categories",
	/** 更新员工市场分类 */
	updateAgentMarketCategory: "/api/v2/admin/super-magic/agents/categories/${id}",
	/** 删除员工市场分类 */
	deleteAgentMarketCategory: "/api/v2/admin/super-magic/agents/categories/${id}",
	/** Skill版本列表 */
	getSkillVersionList: "/api/v1/admin/skills/versions/queries",
	/** Skill 市场列表 */
	getSkillMarketList: "/api/v1/admin/skills/markets/queries",
	/** 更新 Skill 市场信息 */
	updateSkillMarketInfo: "/api/v1/admin/skills/markets/${id}",
	/** 更新 Skill 市场分类关系（全量替换） */
	updateSkillMarketCategoryRelation: "/api/v1/admin/skills/markets/${id}/category",
	/** Skill 市场分类列表 */
	getSkillMarketCategoryList: "/api/v1/admin/skills/categories/queries",
	/** Skill 市场分类详情 */
	getSkillMarketCategoryDetail: "/api/v1/admin/skills/categories/${id}",
	/** 创建 Skill 市场分类 */
	createSkillMarketCategory: "/api/v1/admin/skills/categories",
	/** 更新 Skill 市场分类 */
	updateSkillMarketCategory: "/api/v1/admin/skills/categories/${id}",
	/** 删除 Skill 市场分类 */
	deleteSkillMarketCategory: "/api/v1/admin/skills/categories/${id}",
	/** 解析官方 Skill 压缩包（导入第一阶段） */
	parseOfficialSkillFile: "/api/v1/admin/official-skills/import/parse/file",
	/** 导入官方 Skill（导入第二阶段） */
	importOfficialSkill: "/api/v1/admin/official-skills/import",
	/** 审核 Skill 版本 */
	reviewSkillVersion: "/api/v1/admin/skills/versions/${id}/review",
	/** —————— 平台管理 - 能力管理 —————— */
	/** 获取AI能力列表 */
	getAiPowerList: "/api/v1/admin/ai-abilities",
	/** 更改/AI能力详情 */
	updateAiPower: "/api/v1/admin/ai-abilities/${code}",
	/** 能力管理联通性测试  */
	testAiPowerConnection: "/api/v1/admin/ai-abilities/connectivity-test",
	/** —————— 平台管理 - PPT模板 —————— */
	/** 查询PPT模板列表 */
	querySlidesTemplates: "/api/v1/admin/slides-templates/queries",
	/** 获取PPT模板详情 */
	getSlidesTemplate: "/api/v1/admin/slides-templates/${id}",
	/** 创建PPT模板 */
	createSlidesTemplate: "/api/v1/admin/slides-templates",
	/** 更新PPT模板 */
	updateSlidesTemplate: "/api/v1/admin/slides-templates/${id}",
	/** 更新PPT模板状态 */
	updateSlidesTemplateStatus: "/api/v1/admin/slides-templates/${id}/status",
	/** 更新PPT模板排序 */
	updateSlidesTemplateSort: "/api/v1/admin/slides-templates/${id}/sort",
	/** 删除PPT模板 */
	deleteSlidesTemplate: "/api/v1/admin/slides-templates/${id}",
	/** 更新PPT模板标签 */
	updateSlidesTemplateTags: "/api/v1/admin/slides-templates/${id}/tags",
	/** 查询PPT模板分类列表 */
	querySlidesTemplateCategories: "/api/v1/admin/slides-template-categories/queries",
	/** 获取PPT模板分类详情 */
	getSlidesTemplateCategory: "/api/v1/admin/slides-template-categories/${id}",
	/** 创建PPT模板分类 */
	createSlidesTemplateCategory: "/api/v1/admin/slides-template-categories",
	/** 更新PPT模板分类 */
	updateSlidesTemplateCategory: "/api/v1/admin/slides-template-categories/${id}",
	/** 更新PPT模板分类状态 */
	updateSlidesTemplateCategoryStatus: "/api/v1/admin/slides-template-categories/${id}/status",
	/** 更新PPT模板分类排序 */
	updateSlidesTemplateCategorySort: "/api/v1/admin/slides-template-categories/${id}/sort",
	/** 删除PPT模板分类 */
	deleteSlidesTemplateCategory: "/api/v1/admin/slides-template-categories/${id}",
	/** 查询PPT模板标签列表 */
	querySlidesTemplateTags: "/api/v1/admin/slides-template-tags/queries",
	/** 获取PPT模板标签树 */
	getSlidesTemplateTagTree: "/api/v1/admin/slides-template-tags/tree",
	/** 获取PPT模板标签详情 */
	getSlidesTemplateTag: "/api/v1/admin/slides-template-tags/${id}",
	/** 创建PPT模板标签 */
	createSlidesTemplateTag: "/api/v1/admin/slides-template-tags",
	/** 更新PPT模板标签 */
	updateSlidesTemplateTag: "/api/v1/admin/slides-template-tags/${id}",
	/** 更新PPT模板标签状态 */
	updateSlidesTemplateTagStatus: "/api/v1/admin/slides-template-tags/${id}/status",
	/** 更新PPT模板标签排序 */
	updateSlidesTemplateTagSort: "/api/v1/admin/slides-template-tags/${id}/sort",
	/** 删除PPT模板标签 */
	deleteSlidesTemplateTag: "/api/v1/admin/slides-template-tags/${id}",

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
	/** 获取应用菜单详情 */
	getAppMenuDetail: "/api/v1/admin/applications/${id}",
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
}

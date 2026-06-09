export const IMAGE_TYPE = ["image/jpg", "image/png", "image/jpeg"]

/** 权限key映射 */
export const PERMISSION_KEY_MAP: Record<string, string> = {
	/* -- Magic 权限组 ----- */
	/**
	 * 平台级权限组（最大权限）
	 *
	 * 覆盖范围：platform.* + admin.* + workspace.*
	 *
	 * 说明：仅平台组织（isOfficialOrg）的用户才能持有此权限组。
	 * 持有该权限组可通过所有 platform.*、admin.*、workspace.* 权限校验。
	 *
	 * 包含关系：MAGIC_PLATFORM_PERMISSIONS ⊃ MAGIC_ALL_PERMISSIONS ⊃ MAGIC_PERSON_PERMISSIONS
	 */
	MAGIC_PLATFORM_PERMISSIONS: "MAGIC_PLATFORM_PERMISSIONS",
	/**
	 * 管理员权限组
	 *
	 * 覆盖范围：admin.* + workspace.*
	 *
	 * 说明：组织管理员持有此权限组，可通过 admin.*、workspace.* 权限校验，
	 * 但无法访问 platform.* 相关功能。
	 */
	MAGIC_ALL_PERMISSIONS: "MAGIC_ALL_PERMISSIONS",
	/**
	 * 普通成员权限组（最小权限）
	 *
	 * 覆盖范围：workspace.*
	 *
	 * 说明：普通成员持有此权限组，仅可通过 workspace.* 权限校验，
	 * 无法访问 admin.* 及 platform.* 相关功能。
	 */
	MAGIC_PERSON_PERMISSIONS: "MAGIC_PERSON_PERMISSIONS",

	/* -- AI管理 -- */
	/** AI管理 - 模型管理-查询 */
	MODEL_MANAGEMENT_QUERY: "workspace.model.text.query",
	/** AI管理 - 模型管理-编辑 */
	MODEL_MANAGEMENT_EDIT: "workspace.model.text.edit",
	/** AI管理 - 智能绘图-查询 */
	INTELLIGENT_DRAWING_QUERY: "workspace.model.image.query",
	/** AI管理 - 智能绘图-编辑 */
	INTELLIGENT_DRAWING_EDIT: "workspace.model.image.edit",
	/** AI管理 - 视频大模型-查询 */
	VIDEO_MODEL_QUERY: "workspace.model.video.query",
	/** AI管理 - 视频大模型-编辑 */
	VIDEO_MODEL_EDIT: "workspace.model.video.edit",

	/** AI管理 - 员工发布审核-菜单 */
	AGENT_REVIEW_MENU: "menu.ai_management.internal_employee_and_skill.agent",
	/** AI管理 - 员工发布审核-查询 */
	AGENT_REVIEW_QUERY: "workspace.ai.agent_management.query",
	/** AI管理 - 员工发布审核-编辑 */
	AGENT_REVIEW_EDIT: "workspace.ai.agent_management.edit",
	/** AI管理 - 技能发布审核-菜单 */
	SKILL_REVIEW_MENU: "menu.ai_management.internal_employee_and_skill.skill",
	/** AI管理 - 技能发布审核-查询 */
	SKILL_REVIEW_QUERY: "workspace.ai.skill_management.query",
	/** AI管理 - 技能发布审核-编辑 */
	SKILL_REVIEW_EDIT: "workspace.ai.skill_management.edit",

	/* -- 平台管理 -- */
	/** 平台管理 - 模型管理-查询 */
	PLATFORM_MODEL_MANAGEMENT_QUERY: "platform.model.text.query",
	/** 平台管理 - 模型管理-编辑 */
	PLATFORM_MODEL_MANAGEMENT_EDIT: "platform.model.text.edit",
	/** 平台管理 - 智能绘图-查询 */
	PLATFORM_INTELLIGENT_DRAWING_QUERY: "platform.model.image.query",
	/** 平台管理 - 智能绘图-编辑 */
	PLATFORM_INTELLIGENT_DRAWING_EDIT: "platform.model.image.edit",
	/** 平台管理 - 视频大模型-查询 */
	PLATFORM_VIDEO_MODEL_QUERY: "platform.model.video.query",
	/** 平台管理 - 视频大模型-编辑 */
	PLATFORM_VIDEO_MODEL_EDIT: "platform.model.video.edit",
	/** 系统智能体-查询 */
	MODE_MANAGEMENT_QUERY: "platform.agent.official.query",
	/** 系统智能体/模式管理/内置员工-编辑 */
	MODE_MANAGEMENT_EDIT: "platform.agent.official.edit",
	/** 系统技能/能力管理-查询 */
	AI_ABILITY_MANAGEMENT_QUERY: "platform.ai.ability.query",
	/** 系统技能/能力管理-编辑 */
	AI_ABILITY_MANAGEMENT_EDIT: "platform.ai.ability.edit",
	/** 平台管理 - 员工审核 - 查询 */
	PLATFORM_EMPLOYEE_REVIEW_QUERY: "platform.agent.review.query",
	/** 平台管理 - 员工审核 - 编辑 */
	PLATFORM_EMPLOYEE_REVIEW_EDIT: "platform.agent.review.edit",
	/* 平台管理 - 员工市场 - 查询 */
	PLATFORM_EMPLOYEE_MARKET_QUERY: "platform.agent.market.query",
	/** 平台管理 - 员工市场 - 编辑 */
	PLATFORM_EMPLOYEE_MARKET_EDIT: "platform.agent.market.edit",
	/* 平台管理 - skill审核 - 查询 */
	PLATFORM_SKILL_REVIEW_QUERY: "platform.skill.review.query",
	/** 平台管理 - skill审核 - 编辑 */
	PLATFORM_SKILL_REVIEW_EDIT: "platform.skill.review.edit",
	/* 平台管理 - skill市场 - 查询 */
	PLATFORM_SKILL_MARKET_QUERY: "platform.skill.market.query",
	/** 平台管理 - skill市场 - 编辑 */
	PLATFORM_SKILL_MARKET_EDIT: "platform.skill.market.edit",

	/** 平台维护-查询 */
	INFO_MANAGEMENT_QUERY: "platform.setting.maintenance.query",
	/** 平台维护-编辑 */
	INFO_MANAGEMENT_EDIT: "platform.setting.maintenance.edit",
	/** 平台信息-查询 */
	PLATFORM_INFO_MANAGEMENT_QUERY: "platform.setting.platform_info.query",
	/** 平台信息-编辑 */
	PLATFORM_INFO_MANAGEMENT_EDIT: "platform.setting.platform_info.edit",
	/** 应用菜单-查询 */
	APP_MENU_QUERY: "platform.setting.application.query",
	/** 应用菜单-编辑 */
	APP_MENU_EDIT: "platform.setting.application.edit",
}

/** 平台管理 */

/** 平台管理 - 平台模型 */
export const PLATFORM_MODEL_MANAGEMENT = [
	PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_VIDEO_MODEL_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_VIDEO_MODEL_EDIT,
]

/** 平台管理 - 智能体增强 */
export const PLATFORM_AGENT_MANAGEMENT = [
	PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_REVIEW_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_REVIEW_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_MARKET_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_MARKET_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_SKILL_REVIEW_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_SKILL_REVIEW_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_SKILL_MARKET_EDIT,
]

/** 平台管理 - 平台管理配置 */
export const PLATFORM_SYSTEM_SETTING = [
	PERMISSION_KEY_MAP.INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.INFO_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.APP_MENU_QUERY,
	PERMISSION_KEY_MAP.APP_MENU_EDIT,
]

/** 平台管理 - 平台信息 */
export const PLATFORM_INFO_MANAGEMENT = [
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT,
]

/** 平台管理 - 总权限 */
export const PLATFORM_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
	...PLATFORM_AGENT_MANAGEMENT,
	...PLATFORM_SYSTEM_SETTING,
]

/** AI管理 - 自定义大模型 */
export const AI_CUSTOM_MODEL = [
	PERMISSION_KEY_MAP.MODEL_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY,
	PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT,
	PERMISSION_KEY_MAP.VIDEO_MODEL_QUERY,
	PERMISSION_KEY_MAP.VIDEO_MODEL_EDIT,
]

/** AI管理 - 员工发布审核 */
export const AI_EMPLOYEE_REVIEW = [
	PERMISSION_KEY_MAP.AGENT_REVIEW_MENU,
	PERMISSION_KEY_MAP.AGENT_REVIEW_QUERY,
	PERMISSION_KEY_MAP.AGENT_REVIEW_EDIT,
]

/** AI管理 - 技能发布审核 */
export const AI_SKILL_REVIEW = [
	PERMISSION_KEY_MAP.SKILL_REVIEW_MENU,
	PERMISSION_KEY_MAP.SKILL_REVIEW_QUERY,
	PERMISSION_KEY_MAP.SKILL_REVIEW_EDIT,
]

/** AI管理 - 内部员工及技能 */
export const AI_INTERNAL_EMPLOYEE_SKILL = [...AI_EMPLOYEE_REVIEW, ...AI_SKILL_REVIEW]

/** AI管理 - 总权限 */
export const AI_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
	PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS,
	PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS,
	...AI_CUSTOM_MODEL,
	...AI_INTERNAL_EMPLOYEE_SKILL,
]

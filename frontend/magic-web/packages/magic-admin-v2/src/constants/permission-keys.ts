/**
 * 开源版权限 key。
 *
 * 常量名和字符串值与旧版 admin 的 `PERMISSION_KEY_MAP` 保持一致。
 * 企业版专属 key 放在 `enterprise/src/constants/edition-permissions.ts`。
 */
export const BasePermissionKeyMap = {
	/* ---------- Magic 权限组 ---------- */

	/** 平台级权限组：覆盖 platform.*、admin.*、workspace.*。 */
	MAGIC_PLATFORM_PERMISSIONS: "MAGIC_PLATFORM_PERMISSIONS",
	/** 组织管理员权限组：覆盖 admin.*、workspace.*，不包含 platform.*。 */
	MAGIC_ALL_PERMISSIONS: "MAGIC_ALL_PERMISSIONS",
	/** 普通成员权限组：覆盖 workspace.*。 */
	MAGIC_PERSON_PERMISSIONS: "MAGIC_PERSON_PERMISSIONS",

	/* ---------- 平台管理：平台模型 ---------- */

	/** 平台模型管理-查询。 */
	PLATFORM_MODEL_MANAGEMENT_QUERY: "platform.ai.model_management.query",
	/** 平台模型管理-编辑。 */
	PLATFORM_MODEL_MANAGEMENT_EDIT: "platform.ai.model_management.edit",

	/* ---------- 平台管理：智能体增强 ---------- */

	/** 系统智能体/模式管理/内置员工-查询。 */
	MODE_MANAGEMENT_QUERY: "platform.agent.official.query",
	/** 系统智能体/模式管理/内置员工-编辑。 */
	MODE_MANAGEMENT_EDIT: "platform.agent.official.edit",
	/** 系统技能/能力管理-查询。 */
	AI_ABILITY_MANAGEMENT_QUERY: "platform.ai.ability.query",
	/** 系统技能/能力管理-编辑。 */
	AI_ABILITY_MANAGEMENT_EDIT: "platform.ai.ability.edit",
	/** PPT 模板配置-查询。 */
	SLIDES_TEMPLATE_QUERY: "platform.setting.slides_template.query",
	/** PPT 模板配置-编辑。 */
	SLIDES_TEMPLATE_EDIT: "platform.setting.slides_template.edit",
	/** 平台员工发布审核-查询。 */
	PLATFORM_EMPLOYEE_REVIEW_QUERY: "platform.agent.review.query",
	/** 平台员工发布审核-编辑。 */
	PLATFORM_EMPLOYEE_REVIEW_EDIT: "platform.agent.review.edit",
	/** 平台员工市场-查询。 */
	PLATFORM_EMPLOYEE_MARKET_QUERY: "platform.agent.market.query",
	/** 平台员工市场-编辑。 */
	PLATFORM_EMPLOYEE_MARKET_EDIT: "platform.agent.market.edit",
	/** 平台 Skill 发布审核-查询。 */
	PLATFORM_SKILL_REVIEW_QUERY: "platform.skill.review.query",
	/** 平台 Skill 发布审核-编辑。 */
	PLATFORM_SKILL_REVIEW_EDIT: "platform.skill.review.edit",
	/** 平台 Skill 市场-查询。 */
	PLATFORM_SKILL_MARKET_QUERY: "platform.skill.market.query",
	/** 平台 Skill 市场-编辑。 */
	PLATFORM_SKILL_MARKET_EDIT: "platform.skill.market.edit",

	/* ---------- 平台管理：平台设置 ---------- */

	/** 平台信息-查询。 */
	PLATFORM_INFO_MANAGEMENT_QUERY: "platform.setting.platform_info.query",
	/** 平台信息-编辑。 */
	PLATFORM_INFO_MANAGEMENT_EDIT: "platform.setting.platform_info.edit",
	/** 平台应用菜单-查询。 */
	APP_MENU_QUERY: "platform.setting.application.query",
	/** 平台应用菜单-编辑。 */
	APP_MENU_EDIT: "platform.setting.application.edit",

	/* ---------- 天书身份权限 ---------- */

	/** 天书全部权限/超级管理员。 */
	TEAMSHARE_ALL_PERMISSIONS: "super_admin",
	/** 组织所有者。 */
	ORGANIZATION_OWNER: "organization_owner",
} as const satisfies Record<string, string>

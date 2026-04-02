export const IMAGE_TYPE = ["image/jpg", "image/png", "image/jpeg"]

/** 权限key映射 */
export const PERMISSION_KEY_MAP = {
	// ----- 天书权限 -----
	/** 天书全部权限 */
	TEAMSHARE_ALL_PERMISSIONS: "super_admin",
	/** 组织所有者 */
	ORGANIZATION_OWNER: "organization_owner",
	/** 子管理员 */
	TEAMSHARE_SUB_ADMIN: "sub_admin",

	/** OA审批 - 管理分组 */
	APPROVAL_TEMPLATE_CATEGORY_ALL: "TeamshareOS_console_oa_approval_template_category.all",
	/** OA审批 - 新建审批模板 */
	APPROVAL_TEMPLATE_CREATE: "TeamshareOS_console_oa_approval_template.create",
	/** OA审批 - 管理全部模板 */
	APPROVAL_TEMPLATE_ALL: "TeamshareOS_console_oa_approval_template.all",
	/** OA审批 - 管理我创建的及我可管理的模板 */
	APPROVAL_TEMPLATE_PART_ALL: "TeamshareOS_console_oa_approval_template_part_manager.all",
	/** OA审批 - 数据管理 */
	APPROVAL_DATA_VIEW: "TeamshareOS_console_approval_instances_manager.all",
	/** OA审批 - 流程交接 */
	APPROVAL_WORKFLOW_HANDOVER: "TeamshareOS_console_approval_transfers_manager.all",

	/** 企业管理 - 查看组织架构 */
	ORGANIZATION_READ: "TeamshareOS_console_organization.read",
	/** 企业管理 - 修改组织架构 */
	ORGANIZATION_EDIT: "TeamshareOS_console_organization.edit",
	/** 企业管理 - 编辑组织信息 */
	ORGANIZATION_INFO_EDIT: "TeamshareOS_console_organization_info.edit",
	/** 企业管理 - 编辑成员信息 */
	ORGANIZATION_MEMBER_EDIT: "TeamshareOS_console_organization_member.edit",
	/** 企业管理 - 用户组管理 */
	USER_GROUP_ALL: "TeamshareOS_user_group.all",

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
	/** 管控策略-查询 */
	CONTROL_STRATEGY_QUERY: "admin.ai.control_policy.query",
	/** 管控策略-编辑 */
	CONTROL_STRATEGY_EDIT: "admin.ai.control_policy.edit",
	/** AI管理 - 模型管理-查询 */
	MODEL_MANAGEMENT_QUERY: "admin.ai.model_management.query",
	/** AI管理 - 模型管理-编辑 */
	MODEL_MANAGEMENT_EDIT: "admin.ai.model_management.edit",
	/** AI管理 - 智能绘图-查询 */
	INTELLIGENT_DRAWING_QUERY: "admin.ai.image_generation.query",
	/** AI管理 - 智能绘图-编辑 */
	INTELLIGENT_DRAWING_EDIT: "admin.ai.image_generation.edit",

	/* -- 平台套餐 -- */
	/** 套餐管理-查询 */
	PACKAGE_MANAGEMENT_QUERY: "platform.product.manage.query",
	/** 套餐管理-编辑 */
	PACKAGE_MANAGEMENT_EDIT: "platform.product.manage.edit",
	/** 订单管理-查询 */
	ORDER_MANAGEMENT_QUERY: "platform.product.order.query",
	/** 订单管理-编辑 */
	ORDER_MANAGEMENT_EDIT: "platform.product.manage.edit",
	/** 平台管理 - 模型管理-查询 */
	PLATFORM_MODEL_MANAGEMENT_QUERY: "platform.ai.model_management.query",
	/** 平台管理 - 模型管理-编辑 */
	PLATFORM_MODEL_MANAGEMENT_EDIT: "platform.ai.model_management.edit",
	/** 平台管理 - 智能绘图-查询 */
	PLATFORM_INTELLIGENT_DRAWING_QUERY: "platform.ai.image_generation.query",
	/** 平台管理 - 智能绘图-编辑 */
	PLATFORM_INTELLIGENT_DRAWING_EDIT: "platform.ai.image_generation.edit",
	/** 模型审计日志-查询 */
	SAFE_MODEL_AUDIT_LOG_QUERY: "admin.safe.model_audit_log.query",
	/** 系统智能体-查询 */
	MODE_MANAGEMENT_QUERY: "platform.ai.mode_management.query",
	/** 系统智能体-编辑 */
	MODE_MANAGEMENT_EDIT: "platform.ai.mode_management.edit",
	/** 系统技能-查询 */
	AI_ABILITY_MANAGEMENT_QUERY: "platform.ai.ability.query",
	/** 系统技能-编辑 */
	AI_ABILITY_MANAGEMENT_EDIT: "platform.ai.ability.edit",
	/** 平台维护-查询 */
	INFO_MANAGEMENT_QUERY: "platform.setting.maintenance.query",
	/** 平台维护-编辑 */
	INFO_MANAGEMENT_EDIT: "platform.setting.maintenance.edit",
	/** 平台信息-查询 */
	PLATFORM_INFO_MANAGEMENT_QUERY: "platform.setting.platform_info.query",
	/** 平台信息-编辑 */
	PLATFORM_INFO_MANAGEMENT_EDIT: "platform.setting.platform_info.edit",
	/** 代理服务器-查询 */
	PROXY_SERVER_QUERY: "platform.setting.proxy_server.query",
	/** 代理服务器-编辑 */
	PROXY_SERVER_EDIT: "platform.setting.proxy_server.edit",
	/** 应用菜单-查询 */
	APP_MENU_QUERY: "platform.setting.app_menu.query",
	/** 应用菜单-编辑 */
	APP_MENU_EDIT: "platform.setting.app_menu.edit",
	/** AI审查列表-查询 */
	AIAUDIT_QUERY: "platform.ai.content_audit.list",
	/** AI审查-查看详情 */
	AIAUDIT_DETAIL: "platform.ai.content_audit.detail",
	/** AI审查-标记风险 */
	AIAUDIT_MARK_RISK: "platform.ai.content_audit.risk",

	/** 平台租户管理 - 列表 - 查询  */
	ORIENTATION_LIST_QUERY: "platform.organization.list.query",
	/** 平台租户管理 - 列表 - 编辑  */
	ORIENTATION_LIST_EDIT: "platform.organization.list.edit",
	/** 平台租户管理 - 积分 - 查询列表  */
	ORIENTATION_POINTS_LIST: "platform.organization.point_manager.list",
	/** 平台租户管理 - 积分 - 查看详情  */
	ORIENTATION_POINTS_DETAIL: "platform.organization.point_manager.detail",
	/** 平台租户管理 - 积分 - 添加积分  */
	ORIENTATION_POINTS_ADD_POINTS: "platform.organization.point_manager.add_points",
	/** 平台租户管理 - 白名单 - 查询  */
	ORIENTATION_WHITELIST_QUERY: "platform.organization.whitelist.query",
	/** 平台租户管理 - 白名单 - 编辑  */
	ORIENTATION_WHITELIST_EDIT: "platform.organization.whitelist.edit",

	/* -- 安全管控 -- */
	/** 组织管理员-查询 */
	ADMIN_USER_QUERY: "admin.safe.admin.query",
	/** 组织管理员-编辑 */
	ADMIN_USER_EDIT: "admin.safe.admin.edit",
	/** 子管理员-查询 */
	SUB_ADMIN_QUERY: "admin.safe.sub_admin.query",
	/** 子管理员-编辑 */
	SUB_ADMIN_EDIT: "admin.safe.sub_admin.edit",
	/**  管理员操作日志-查询 */
	ADMIN_OPERATION_LOGS_QUERY: "admin.safe.operation_log.query",
	/**  管理员操作日志-编辑 */
	ADMIN_OPERATION_LOGS_EDIT: "admin.safe.operation_log.edit",
}

/** 企业管理 */
/** 企业管理 - 用量管控 */
export const ENTERPRISE_USAGE_CONTROL = [
	PERMISSION_KEY_MAP.CONTROL_STRATEGY_QUERY,
	PERMISSION_KEY_MAP.CONTROL_STRATEGY_EDIT,
]

/** 企业管理 - 组织架构 */
export const ENTERPRISE_ORGANIZATION_MANAGEMENT = [
	PERMISSION_KEY_MAP.ORGANIZATION_READ,
	PERMISSION_KEY_MAP.ORGANIZATION_EDIT,
	PERMISSION_KEY_MAP.ORGANIZATION_INFO_EDIT,
	PERMISSION_KEY_MAP.ORGANIZATION_MEMBER_EDIT,
	PERMISSION_KEY_MAP.USER_GROUP_ALL,
]

/** 企业管理 - 安全管控 */
export const ENTERPRISE_SECURITY_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS,
	PERMISSION_KEY_MAP.ADMIN_USER_QUERY,
	PERMISSION_KEY_MAP.ADMIN_USER_EDIT,
	PERMISSION_KEY_MAP.SUB_ADMIN_QUERY,
	PERMISSION_KEY_MAP.SUB_ADMIN_EDIT,
	PERMISSION_KEY_MAP.ADMIN_OPERATION_LOGS_QUERY,
	PERMISSION_KEY_MAP.ADMIN_OPERATION_LOGS_EDIT,
]

/**  企业管理 - OA审批 */
export const ENTERPRISE_OA_APPROVAL = [
	PERMISSION_KEY_MAP.APPROVAL_TEMPLATE_CATEGORY_ALL,
	PERMISSION_KEY_MAP.APPROVAL_TEMPLATE_CREATE,
	PERMISSION_KEY_MAP.APPROVAL_TEMPLATE_ALL,
	PERMISSION_KEY_MAP.APPROVAL_TEMPLATE_PART_ALL,
	PERMISSION_KEY_MAP.APPROVAL_DATA_VIEW,
	PERMISSION_KEY_MAP.APPROVAL_WORKFLOW_HANDOVER,
]

/** 企业管理 - 总权限 */
export const ENTERPRISE_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS,
	PERMISSION_KEY_MAP.TEAMSHARE_ALL_PERMISSIONS,
	PERMISSION_KEY_MAP.ORGANIZATION_OWNER,
	PERMISSION_KEY_MAP.TEAMSHARE_SUB_ADMIN,
	...ENTERPRISE_USAGE_CONTROL,
	...ENTERPRISE_OA_APPROVAL,
	...ENTERPRISE_ORGANIZATION_MANAGEMENT,
	...ENTERPRISE_SECURITY_MANAGEMENT,
]

/**  平台管理 */
/**  平台管理 - 平台套餐 */
export const PLATFORM_PACKAGE_MANAGEMENT = [
	PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PACKAGE_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.ORDER_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.ORDER_MANAGEMENT_EDIT,
]

/**  平台管理 - 平台模型 */
export const PLATFORM_MODEL_MANAGEMENT = [
	PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INTELLIGENT_DRAWING_EDIT,
	PERMISSION_KEY_MAP.SAFE_MODEL_AUDIT_LOG_QUERY,
]

/**  平台管理 - 智能体增强 */
export const PLATFORM_AGENT_MANAGEMENT = [
	PERMISSION_KEY_MAP.MODE_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.MODE_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.AI_ABILITY_MANAGEMENT_EDIT,
]
/**  平台管理 - 平台管理配置 */
export const PLATFORM_SYSTEM_SETTING = [
	PERMISSION_KEY_MAP.INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.INFO_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.PROXY_SERVER_QUERY,
	PERMISSION_KEY_MAP.PROXY_SERVER_EDIT,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.APP_MENU_QUERY,
	PERMISSION_KEY_MAP.APP_MENU_EDIT,
	PERMISSION_KEY_MAP.AIAUDIT_QUERY,
	PERMISSION_KEY_MAP.AIAUDIT_DETAIL,
	PERMISSION_KEY_MAP.AIAUDIT_MARK_RISK,
]
/** 平台管理 - 平台租户管理 */
export const PLATFORM_ORIENTATION_MANAGEMENT = [
	PERMISSION_KEY_MAP.ORIENTATION_LIST_QUERY,
	PERMISSION_KEY_MAP.ORIENTATION_LIST_EDIT,
	PERMISSION_KEY_MAP.ORIENTATION_POINTS_LIST,
	PERMISSION_KEY_MAP.ORIENTATION_POINTS_DETAIL,
	PERMISSION_KEY_MAP.ORIENTATION_POINTS_ADD_POINTS,
]

/**  平台管理 - 平台信息 */
export const PLATFORM_INFO_MANAGEMENT = [
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT,
]

/**  平台管理 - 总权限 */
export const PLATFORM_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS,
	...PLATFORM_PACKAGE_MANAGEMENT,
	...PLATFORM_AGENT_MANAGEMENT,
	...PLATFORM_SYSTEM_SETTING,
	...PLATFORM_ORIENTATION_MANAGEMENT,
]

/** AI管理 - 总权限 */
export const AI_MANAGEMENT = [
	PERMISSION_KEY_MAP.MAGIC_ALL_PERMISSIONS,
	PERMISSION_KEY_MAP.MAGIC_PERSON_PERMISSIONS,
	PERMISSION_KEY_MAP.MODEL_MANAGEMENT_QUERY,
	PERMISSION_KEY_MAP.MODEL_MANAGEMENT_EDIT,
	PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_QUERY,
	PERMISSION_KEY_MAP.INTELLIGENT_DRAWING_EDIT,
]

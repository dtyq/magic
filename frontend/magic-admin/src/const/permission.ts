export const PERMISSION_KEY_MAP = {
	ADMIN: "admin", // 管理后台
	ADMIN_AI: "admin.ai", // AI管理

	ADMIN_AI_MODEL_MANAGEMENT: "admin.ai.model_management", // 模型管理
	ADMIN_AI_MODEL_MANAGEMENT_MODEL_EDIT: "admin.ai.model_management.model_edit", // 模型管理-编辑
	ADMIN_AI_MODEL_MANAGEMENT_MODEL_QUERY: "admin.ai.model_management.model_query", // 模型管理-查询

	ADMIN_AI_IMAGE_GENERATION: "admin.ai.image_generation", // 智能绘图
	ADMIN_AI_IMAGE_GENERATION_IMAGE_QUERY: "admin.ai.image_generation.image_query", // 智能绘图-查询
	ADMIN_AI_IMAGE_GENERATION_IMAGE_EDIT: "admin.ai.image_generation.image_edit", // 智能绘图-编辑

	ADMIN_AI_CONTROL_POLICY: "admin.ai.control_policy", // 管控策略
	ADMIN_AI_CONTROL_POLICY_POLICY_EDIT: "admin.ai.control_policy.policy_edit", // 管控策略-编辑
	ADMIN_AI_CONTROL_POLICY_POLICY_QUERY: "admin.ai.control_policy.policy_query", // 管控策略-查询

	ADMIN_SECURITY: "admin.security", // 安全管理
	ADMIN_SECURITY_USER_GROUP: "admin.security.user_group", // 用户组管理
	ADMIN_SECURITY_USER_GROUP_EDIT: "admin.security.user_group.edit", // 用户组管理-编辑
	ADMIN_SECURITY_USER_GROUP_QUERY: "admin.security.user_group.query", // 用户组管理-查询
	ADMIN_SECURITY_USER_GROUP_DELETE: "admin.security.user_group.delete", // 用户组管理-删除
	ADMIN_SECURITY_USER_GROUP_ADD: "admin.security.user_group.add", // 用户组管理-添加
	PARTNER_EDIT: "TeamshareOS_console_partner.edit", // 编辑合作伙伴
	ENTERPRISE_PROJECT_READ: "TeamshareOS_console_enterprise_project.read", // 查看企业项目
	ENTERPRISE_PROJECT_EDIT: "TeamshareOS_console_enterprise_project.edit", // 编辑企业项目
	ENTERPRISE_PROJECT_ALL: "TeamshareOS_console_enterprise_project.all", // 企业项目所有权限

	STORE_READ: "TeamshareOS_console_store.read", // 查看门店信息
	STORE_EDIT: "TeamshareOS_console_store.edit", // 编辑门店信息
	STORE_ALL: "TeamshareOS_console_store.all", // 门店信息所有权限

	IAM_ALL: "TeamshareOS_console_iam.all", // IAM管理
	ADMIN_READ: "TeamshareOS_console_admin.read", // 查看管理员
	ADMIN_EDIT: "TeamshareOS_console_admin.edit", // 编辑管理员
	ADMIN_LOG_READ: "TeamshareOS_console_admin_log.read", // 查看管理员日志
	APPLICATION_CREATE: "TeamshareOS_application.create", // 创建应用
	APPLICATION_MENU: "TeamshareOS_application.read", // 是否显示应用目录
	SUB_ADMIN_EDIT: "TeamshareOS_console_sub_admin.edit", // 编辑子管理员
	APP_ROLE: "TeamshareOS_console_application_role.all", // 应用角色管理
	APPROVAL_TEMPLATE_CATEGORY_ALL: "TeamshareOS_console_oa_approval_template_category.all", // 管理分组
	APPROVAL_TEMPLATE_CREATE: "TeamshareOS_console_oa_approval_template.create", // 新建审批模板
	APPROVAL_TEMPLATE_ALL: "TeamshareOS_console_oa_approval_template.all", // 管理全部模板
	APPROVAL_TEMPLATE_PART_ALL: "TeamshareOS_console_oa_approval_template_part_manager.all", // 管理我创建的及我可管理的模板
	USER_GROUP_ALL: "TeamshareOS_user_group.all", // 用户组管理

	APPROVAL_DATA_VIEW: "TeamshareOS_console_approval_instances_manager.all", // OA审批 - 数据管理
	APPROVAL_WORKFLOW_HANDOVER: "TeamshareOS_console_approval_transfers_manager.all", // OA审批 - 流程交接
}

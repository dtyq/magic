import type { PageParams } from "./common"

/** 功能管理 */
export namespace CapabilityManage {
	/** 文件临时链接 */
	export interface File {
		key: string
		uid: string
		name: string
		url?: string
	}

	/** 文件临时链接参数 */
	export interface FileTemporaryLinkParams {
		/** 文件key */
		files: File[]
	}

	/** 用户信息 */
	export interface UserInfo {
		id: string
		name: string
		avatar: string
	}

	/** 审批数据查看参数 */
	export interface OaApprovalDataParams extends PageParams {
		/** 关键词 */
		keyword?: string
		/** 审批状态 */
		result?: ApprovalStatus
		/** 审批状态名称 */
		result_name?: string
		/** 审批模版code */
		template_codes?: string[]
		/** 发起人ID */
		starter_id?: string
		/** 审批单号 */
		id?: string
		/** 创建时间开始 */
		created_at_start?: string
		/** 创建时间结束 */
		created_at_end?: string
		/** 完成时间开始 */
		finished_at_start?: string
		/** 完成时间结束 */
		finished_at_end?: string
	}

	/** 审批状态 */
	export enum ApprovalStatus {
		/** 未运行 */
		NOT_RUNNING = 0,
		/** 开始 */
		START = 1,
		/** 处理 */
		PROCESS = 2,
		/** 同意 */
		AGREE = 4,
		/** 召回 */
		RECALL = 3,
		/** 拒绝 */
		REJECT = 5,
		/** 抄送 */
		CC = 6,
		/** 取消 */
		CANCEL = 7,
		/** 忽略 */
		IGNORE = 8,
		/** 处理 */
		HANDEL = 9,
		/** 转发 */
		FORWARD = 10,
		/** 已处理 */
		PROCESSED = 11,
	}

	/** 审批数据查看 */
	export interface OaApprovalData {
		/** 审批单号 */
		id: string
		/** 标题 */
		title: string
		/** 审批结果 */
		result: ApprovalStatus
		/** 创建时间 */
		created_at: string
		/** 完成时间 */
		finished_at: string | null
		/** 审批耗时 */
		duration_formatted: string
		/** 审批结果名称 */
		result_name: string
		/** 发起人姓名 */
		starter_name: string
		/** 审批模板code */
		template_code: string
		/** 发起人头像 */
		starter_avatar: string
		/** 当前审批人 */
		current_approval_users_info: UserInfo[]
	}

	/** 导出记录状态 */
	export enum ExportRecordStatus {
		/** 待处理 */
		Pending = "pending",
		/** 导出中 */
		Processing = "processing",
		/** 导出成功 */
		Completed = "completed",
		/** 导出失败 */
		Failed = "failed",
	}

	/** 导出实例参数 */
	export interface ExportInstanceParams extends Omit<OaApprovalDataParams, "id" | "result_name"> {
		/** 审批单号 */
		ids?: string[]
	}

	/** 导出实例 */
	export interface ExportInstance {
		id: string
		/** 文件名 */
		file_name: string
		/** 文件key */
		file_key: string
		/** 导出状态 */
		status: ExportRecordStatus
	}

	/** 导出记录参数 */
	export interface ExportRecordParams extends PageParams {
		/** 导出状态 */
		status?: ExportRecordStatus
	}

	// 导出类型数据
	export enum ExportDataType {
		/** 数据 */
		Data = "data",
		/** 附件 */
		Attachment = "attachment",
		/** 人员时效详情导出 */
		UserTimelinessDetails = "user_timeliness_details",
		/** 审批时效详情导出 */
		ApprovalTimelinessDetails = "approval_timeliness_details",
		/** 人员时效导出 */
		UserTimeliness = "user_timeliness",
		/** 审批时效导出 */
		ApprovalTimeliness = "approval_timeliness",
	}

	/** 导出记录 */
	export interface ExportRecord {
		id: string
		/** 导出时间 */
		created_at: string
		/** 导出状态 */
		status: ExportRecordStatus
		/** 文件名 */
		file_name: string
		/** 文件key */
		file_key: string
		/** 文件url */
		file_url: string
		/** 创建人 */
		creator: UserInfo
		/** 导出类型 data */
		type: ExportDataType
	}

	/** 审批模板发布状态 */
	export enum PublishStatus {
		/** 未发布-草稿 停用 */
		UNPUBLISHED = 1,
		/** 已发布-已发布 启用 */
		PUBLISHED = 2,
	}

	/** 审批模板列表 */
	export interface ApprovalTemplateList {
		id: string
		code: string
		name: string
		logo: string
		/** 描述 */
		description: string
		/** 可见范围 */
		visible: string
		/** 更新时间 */
		updated_at: string
		/** 创建时间 */
		created_at: string
		/** 发布状态 */
		publish_status: PublishStatus
		advanced_process_setting: AdvancedProcessSetting
	}

	/** 审批模板组参数 */
	export interface ApprovalTemplateGroupParams extends PageParams {
		/** 模板组code */
		group?: string
	}

	/** 审批模板组 */
	export interface ApprovalTemplateGroup {
		/** 模板组code */
		code: string
		/** 模板组id */
		id: string
		/** 模板组名称 */
		name: string
		/** 排序 */
		sort_order: string
		/** 模板数量 */
		template_count: number
		/** 审批模板列表 */
		approval_templates: ApprovalTemplateList[]
		/** 多语言 */
		translation: {
			name: Translation
		}
	}

	/** 待交接审批列表参数 */
	export interface TransferListParams extends PageParams {
		/** 审批人id/标题 */
		approver_id?: string
		/** 模板code */
		template_codes?: string[]
		/** 审批身份 */
		identity_type?: number
	}

	/** 待交接审批列表 */
	export interface TransferList {
		/** 标题 */
		title: string
		/** 创建时间 */
		created_at: string
		/** 模板code */
		template_code: string
		/** 模板名称 */
		template_name: string
		/** 实例id */
		instance_id: string
	}

	/** 交接记录列表参数 */
	export interface TransferRecordListParams extends PageParams {
		/** 待交接人ID */
		from_user_id?: string
		/** 交接人ID */
		to_user_id?: string
		/** 操作人ID */
		operator_user_id?: string
		/** 状态 */
		status?: number
		/** 开始时间 */
		start_time?: string
		/** 结束时间 */
		end_time?: string
	}

	// /** 交接记录状态 */
	// export enum RecordStatus {
	// 	/** 待交接 */
	// 	pending = "pending",
	// 	/** 成功 */
	// 	success = "success",
	// 	/** 异常 */
	// 	failed = "failed",
	// }

	/** 交接记录列表 */
	export interface TransferRecordList {
		id: string
		/** 实例id */
		instance_id: string
		/** 状态 */
		status: string
		/** 交接原因 */
		reason: string
		/** 交接人 */
		to_user: UserInfo
		/** 交接人 */
		from_user: UserInfo
		/** 操作人 */
		operator: UserInfo
		/** 创建时间 */
		created_at: string
		/** 更新时间 */
		updated_at: string
		/** 错误信息 */
		error_message: string
	}

	/** 发起新交接参数 */
	export interface InitiateNewTransferParams {
		/** 待交接人id */
		from_user_ids?: string[]
		/** 交接人id */
		to_user_id?: string
		/** 是否待交接待处理 */
		is_transfer_pending?: boolean
		/** 是否已交接发起且运行中 */
		is_transfer_initiated?: boolean
		/** 审批原因 */
		reason?: string
	}

	/** 审批单+批量交接参数 */
	export interface ApproveTransferParams {
		/** 实例id */
		instance_ids?: string[]
		/** 待交接人id */
		from_user_id?: string
		/** 交接人id */
		to_user_id?: string
		/** 审批原因 */
		reason: string
		/** 发起人转交 */
		is_transfer_initiated: boolean
		/** 审批人转交 */
		is_transfer_pending: boolean
	}

	/** 批量审批交接统计参数 */
	export interface BatchStatisticsParams {
		from_user_ids: string[]
	}
	/** 批量审批交接统计 */
	export interface BatchStatistics {
		/** 待处理数量 */
		pending_count: number
		/** 发起且运行中数量 */
		initiated_count: number
	}

	/* 离职人员列表参数 */
	export interface ResignedUserListParams extends Required<PageParams> {
		/* 离职人员id */
		keyword?: string
	}

	/** 离职人员列表 */
	export interface ResignedUserList {
		id: string
		real_name: string
		avatar: string
		department: string[]
		department_paths: string[]
	}

	/** 审批模板交接参数 */
	export interface ApproveTemplateTransferParams {
		/** 待交接人id */
		from_user_id: string
		/** 交接人id */
		to_user_id: string
		/** 模板code */
		template_codes: string
		/** 审批原因 */
		reason: string
	}

	/** 审批模板交接列表参数 */
	export interface TemplateTransferListParams extends TransferRecordListParams {
		/** 模板code */
		template_code?: string
	}

	/** 审批模板交接列表 */
	export interface TemplateTransferList {
		/** 实例id */
		id: string
		/** 交接人 */
		to_user: UserInfo
		/** 交接人 */
		from_user: UserInfo
		/** 操作人 */
		operator: UserInfo
		/** 模板 */
		templates: Pick<ApprovalTemplateList, "code" | "name">[]
		/** 模板数量 */
		template_count: number
		/** 原因 */
		reason: string
		/** 状态 */
		status: string
		/** 创建时间 */
		created_at: string
	}

	/** 获取审批模板分组列表参数 */
	export interface GetTemplateGroupListParams extends PageParams {
		/** 是否只显示关联的审批模版, 1: 是, 0: 否 */
		user_related?: 1 | 0
		/** 用户id */
		user_id: string
	}

	/** 创建审批分组参数 */
	export interface TemplateGroupParams {
		/** 审批分组code */
		code?: string
		/** 审批分组名称 */
		name?: string
		temp?: boolean
		edit?: boolean
		/** 排序 */
		sort_order?: number
		/** 多语言 */
		translation?: {
			name?: Translation
		}
	}

	/** 审批分组排序参数 */
	export interface UpdateTemplateGroupParams {
		categories: {
			/** 审批分组名称 */
			code: string
			/** 排序 */
			sort_order: number
		}[]
	}

	/** 限时审批模版统计 */
	export interface TimeLimitTemplateStatistics {
		/** 全部 */
		total: number
		/** 启用数量 */
		enabled: number
		/** 未启用数量 */
		disabled: number
	}

	/** 限时审批模板列表参数 */
	export interface TimeLimitTemplateListParams extends PageParams {
		/** 模糊搜索 */
		name?: string
		/** 启用状态 1= 启动 0=未启用 */
		status?: number
	}

	/** 限时审批模板列表 */
	export interface TimeLimitTemplate {
		/** 模板code */
		template_code: string
		/** 模板名称 */
		template_name: string
		/** 模板logo */
		template_logo: string
		/** 是否启用 */
		is_enabled: boolean
		/** 提醒操作执行次数统计 */
		reminder_count: number
		/** 转派操作执行次数统计 */
		transfer_count: number
		/** 自动同意操作执行次数统计  */
		agree_count: number
		/** 自动拒绝操作执行次数统计 */
		reject_count: string
		/** 模版所属分组代码 */
		group: string
	}

	/** 限时审批规则类型 */
	export enum RuleType {
		/** 计时类型 */
		Timer = "timer",
		/** 定时类型 */
		Scheduled = "scheduled",
	}

	/** 时间单位 */
	export enum TimeUnit {
		/** 分钟 */
		Minute = "minute",
		/** 小时 */
		Hour = "hour",
		/** 天 */
		Day = "day",
	}

	/** 限时审批目标类型 */
	export enum TargetType {
		/** 审批人 */
		Approver = "current_approver",
		/** 发起人 */
		Initiator = "initiator",
		/** 部门 */
		Department = "department",
		/** 用户 */
		User = "user",
	}

	/** 限时审批执行动作类型 */
	export enum ActionType {
		/** 提醒 */
		Reminder = "reminder",
		/** 转派 */
		Transfer = "transfer",
		/** 同意 */
		Agree = "agree",
		/** 拒绝 */
		Reject = "reject",
	}

	/** 限时审批通知方式 */
	export enum NotificationMethod {
		/** 钉钉 */
		DingTalk = "dingtalk",
		/** 邮件 */
		Email = "email",
		/** 短信 */
		SMS = "sms",
		/** 工作通知 */
		WorkNotice = "work_notice",
	}

	/** 限时审批提醒目标 */
	export interface ReminderTarget {
		/** 目标类型 */
		key: TargetType
		/** 目标值 */
		value: string
		/** 目标名称 */
		label: string
		/** 目标头像 */
		avatar?: string
	}

	/** 限时审批排除的时间段配置 */
	export interface ExcludeTimeRanges {
		id?: string
		/** 周几排除(0=周日,1=周一...6=周六) */
		weekdays?: number[]
		/** 时间段列表 */
		time_ranges?: Array<{
			/** 开始时间 */
			start?: string
			/** 结束时间 */
			end?: string
		}>
	}

	/** 不计时时间配置 */
	export interface UnTimedConfig {
		id?: string
		/** timer类型：是否排除节假日 */
		exclude_holidays?: boolean
		/** timer类型：排除的时间段配置 */
		exclude_time_ranges?: ExcludeTimeRanges[]
		/** timer类型：是否自定义时间 */
		is_exclude_time_ranges?: boolean
	}

	/** Timer类型配置 */
	export interface TimerConfig {
		/** timer类型：时间数值 */
		value: number
		/** timer类型：时间单位 */
		unit: TimeUnit
	}

	/** 定时规则提醒周期 */
	export enum ReminderCycle {
		NEXT = "next_time",
		NEXT_MONDAY = "next_monday",
		NEXT_TUESDAY = "next_tuesday",
		NEXT_WEDNESDAY = "next_wednesday",
		NEXT_THURSDAY = "next_thursday",
		NEXT_FRIDAY = "next_friday",
		NEXT_SATURDAY = "next_saturday",
		NEXT_SUNDAY = "next_sunday",
	}

	/** Scheduled类型配置 */
	export interface ScheduledConfig {
		/** scheduled类型：触发类型 */
		type?: ReminderCycle
		/** scheduled类型：执行时间(HH:mm格式) */
		time?: string
	}

	/** 规则配置 */
	export interface Rule {
		/** 规则id */
		id: string
		/** 规则显示名称 */
		name: string
		/** 规则类型：timer(计时)、scheduled(定时) */
		type: RuleType
		/** 规则配置参数 */
		config: TimerConfig | ScheduledConfig
		/** 提醒目标列表 */
		reminder_targets: ReminderTarget[]
		/** 执行动作 */
		action_type: ActionType
		/** 通知方式 */
		notification_method: NotificationMethod
	}

	/** 限时审批模板规则配置详情 */
	export interface TimeLimitTemplateDetail {
		id?: string
		/** 规则分组唯一标识 */
		code: string
		/** 规则分组类型 */
		type?: RuleType
		/** 规则分组显示名称 */
		name: string
		/** 是否为默认规则分组 */
		is_default?: boolean
		/** 具体规则列表 */
		rules: Rule[]
	}

	/** 限时审批模板配置详情分组列表 */
	export interface TimeLimitTemplateDetailList {
		rule_groups: TimeLimitTemplateDetail[]
	}

	/** 创建规则组 */
	export interface CreateRuleGroup {
		/** 规则组名称 */
		name: string
		id: string
		code: string
		/** 审批模板详情 */
	}

	export interface LogoData {
		key: string
		name: string
		path: string
		platform: string
		url: string
		expires: number
		uid: string
	}

	export enum SummaryMode {
		/** 系统默认 */
		SYSTEM_DEFAULT = "default",
		/** 自定义 */
		CUSTOM = "custom",
	}

	/** 可见范围类型 */
	export enum Visibility {
		/** 全员可见 */
		ALL = 1,
		/** 指定成员/部门可见 */
		SPECIFIED = 2,
	}

	/** 人员数据 */
	export interface UserInfoData {
		departments: UserInfo[]
		users: UserInfo[]
		user_groups: UserInfo[]
	}

	export interface AdvancedProcessSetting {
		/** 是否不允许编辑模板 */
		is_disallow_edit_template?: 0 | 1
		/** 是否添加签名 */
		is_add_signature: 0 | 1
		/** 是否自动去重 */
		is_automatic_deduplicate: 0 | 1
		/** 自动去重类型，0-无，1-仅首个节点，2-仅连续审批（默认1） */
		automatic_deduplicate_type: 0 | 1 | 2
		/** 是否需要审批意见 */
		is_require_comment: 0 | 1
		/** 评语仅管理员和审批人可见 */
		is_comment_visible_to_approvers_only: 0 | 1
		/** 是否隐藏模板 */
		is_hide_template: 0 | 1
		/** 是否不允许重新发起审批 */
		is_disallow_reinitiate: 0 | 1
		/** 是否不允许退回审批 */
		is_disallow_return: 0 | 1
		/** 通知设置 */
		notification_setting: {
			/** 或签节点仅需通知或签操作审批通过人员 */
			is_or_sign_notify_only_approved: 0 | 1
			/** 发起人撤销审批时，无需通知办理人/审批人 */
			is_no_notify_on_revoke: 0 | 1
		}
	}

	// 更多设置
	export interface MoreSetting {
		/** 是否启用AI审批 */
		enable_ai_review: 0 | 1
		/** AI 子流程 */
		ai_process_code: string
		/** 是否启用 AI 示例 */
		is_ai_examples_enabled: 0 | 1
		/** 是否启用AI对话模板 */
		is_ai_conversation_template_enabled: 0 | 1
		/** ai 对话模板 */
		ai_conversation_template: string | null
		/** ai 示例 */
		ai_examples: any

		/** 摘要模式 */
		summary_mode: SummaryMode
		/** 摘要设置 */
		summary_settings: string[]

		/** 限时审批 */
		enable_time_limited: 0 | 1
		/** 限时审批规则组 */
		time_limited_rule_groups: Record<string, any>

		/** 高级设置 */
		advanced_process_setting: AdvancedProcessSetting
	}

	/** 审批模版详情 */
	export interface ApprovalTemplateDetail extends MoreSetting {
		id: string
		code: string
		name: string
		/** 发布状态 */
		publish_status: PublishStatus
		/** 所属分组 */
		group: string
		/** 模版logo */
		logo: string[] | LogoData
		/** 模版描述 */
		description: string
		/** 模版版本 */
		version: number
		// approve_nodes: ApprovalNode[]
		form_data: any
		form_metadata: any
		approval_metadata: {
			nodes: any
			start_code: string
			properties: any
		}
		/** 可见范围类型 */
		visibility: Visibility
		/** 可见范围 */
		visibility_data: UserInfoData
		/** 管理范围 */
		manager_data: UserInfoData
	}

	export interface SaveApprovalTemplate
		extends Omit<ApprovalTemplateDetail, "visibility_data" | "manager_data"> {
		visibility_data: {
			department_ids: string[]
			user_ids: string[]
			user_group_ids: string[]
		}
		manager_data: {
			department_ids: string[]
			user_ids: string[]
			user_group_ids: string[]
		}
	}

	export enum ApprovalValidityStatus {
		/** 关闭 */
		Inactive = 0,
		/** 开启 */
		Active = 1,
	}

	/** 人员时效统计查询参数 */
	export interface PersonTimeValidityParams extends PageParams {
		/** 用户ID列表 */
		user_ids?: string[]
		/** 模版code列表 */
		template_codes?: string[]
		/** 发起开始时间（YYYY-MM-DD） */
		start_date?: string
		/** 发起结束时间（YYYY-MM-DD） */
		end_date?: string
	}

	/** 人员时效统计响应数据 */
	export interface PersonTimeValidityItem {
		/** 审批人ID */
		user_id: string
		/** 审批人姓名 */
		user_name: string
		/** 审批人头像 */
		avatar: string
		/** 审批单数：参与审批的审批单总数量 */
		approval_count: number
		/** 审批次数：实际审批操作的次数 */
		approval_times: number
		/** 完成次数：审批同意或拒绝的次数 */
		completed_times: number
		/** 总审批耗时：所有审批单耗时总和(格式化) */
		total_duration_formatted: string
		/** 审批平均耗时：平均每个审批单的耗时(格式化) */
		avg_duration_formatted: string
		/** 自动提醒次数：限时提醒的总次数 */
		auto_reminder_times: number
	}

	/** 人员时效统计详情流程列表 */
	export interface PersonTimeValidityDetail {
		/** 审批名称 */
		approval_name: string
		/** 自动提醒次数 */
		auto_reminder_count: number
		/** 耗时(格式化) */
		duration_formatted: string
		/** 审批结束时间 */
		end_time: string
		/** 审批实例ID */
		instance_id: string
		/** 审批节点名称 */
		node_name: string
		/** 审批开始时间 */
		start_time: string
	}

	/** 审批时效统计查询参数 */
	export interface TemplateTimeValidityParams extends PageParams {
		/** 模版code列表 */
		template_codes?: string[]
		/** 状态 */
		status?: 1 | 0
		/** 发起开始时间（YYYY-MM-DD） */
		start_date?: string
		/** 发起结束时间（YYYY-MM-DD） */
		end_date?: string
	}

	/** 审批时效统计响应数据 */
	export interface TemplateTimeValidityItem {
		/** 模板ID */
		template_id: number
		/** 模板编码 */
		template_code: string
		/** 审批名称(模板名称) */
		template_name: string
		/** 发起次数：使用此模板发起的审批单总数 */
		initiated_count: number
		/** 超时次数：审批超时的审批单数量 */
		timeout_count: number
		/** 自动提醒：限时提醒的总次数 */
		auto_reminder_times: number
		/** 平均耗时：此模板审批单的平均耗时(格式化) */
		avg_duration_formatted: string
		/** 模板状态：active-开启 inactive-关闭 */
		status: ApprovalValidityStatus
	}

	/** 审批时效统计详情流程列表 */
	export interface TemplateTimeValidityDetail {
		/** 自动提醒次数 */
		auto_reminder_times: number
		/** 平均耗时(格式化) */
		avg_duration_formatted: string
		/** 处理次数 */
		handled_count: number
		/** 节点ID */
		node_id: string
		/** 节点名称 */
		node_name: string
		/** 节点类型 */
		node_type: string
		/** 总耗时 */
		total_duration: string
	}

	export interface UpdateApprovalTemplateInfo {
		name?: string
		description?: string
		category_code?: string
		visibility_data?: {
			department_ids: string[]
			user_ids: string[]
			user_group_ids: string[]
		}
	}

	export enum MultiLangModule {
		/** 基础模块 */
		Base = "base",
		/** 表单模块 */
		Form = "form",
		/** 流程模块 */
		Flow = "flow",
	}

	/** 基础模块 - 对象类型 */
	export enum BaseObjectType {
		Base = "base",
	}

	/** 表单模块 - 对象类型 */
	export enum FormObjectType {
		Input = "Input",
		Money = "Money",
		Phone = "Phone",
		Email = "Email",
		IdCard = "IdCard",
		Upload = "Upload",
		FormGrid = "FormGrid",
		Rate = "Rate",
		Text = "Text",
		Remark = "Remark",
		Radio = "Radio",
		Checkbox = "Checkbox",
		CheckBoxGroup = "CheckBoxGroup",
		Select = "Select",
		Collapse = "Collapse",
		DateTimePicker = "DateTimePicker",
		RadioGroup = "RadioGroup",
		InputNumber = "InputNumber",
		MemberSelect = "MemberSelect",
		DatePickerEnhance = "DatePickerEnhance",
		Table = "Table",
		Switch = "Switch",
		Partner = "Partner",
		Cascader = "Cascader",
		ApprovalRelated = "ApprovalRelated",
		Slider = "Slider",
		Divider = "Divider",
	}

	/** 流程模块 - 对象类型 */
	export enum FlowObjectType {
		/** 审批人 */
		ApprovalUsers = "approval_users",
		/** 抄送人 */
		ApprovalCc = "approval_cc",
		/** 办理人节点 */
		ApprovalTransactor = "approval_transactor",
		/* 条件分支 */
		ConditionBranch = "condition",
	}

	export enum AttributeKey {
		/** 名称 */
		Name = "name",
		/** 描述 */
		Description = "desc",
		/** 占位符 */
		Placeholder = "placeholder",
		/** 选项 */
		Options = "options",
	}

	export enum Language {
		zh_CN = "zh_CN",
		en_US = "en_US",
	}

	export interface Translation {
		[Language.zh_CN]: string
		[Language.en_US]: string
	}

	/** 审批模版多语言数据 */
	export interface ApprovalTemplateMultiLang {
		id: string
		module: MultiLangModule
		object_key: string
		object_type: FormObjectType | FlowObjectType | BaseObjectType
		attribute_key: AttributeKey
		text: string
		translation: Translation
	}

	export interface SaveMultiLangData {
		translations: {
			id: string
			translation: Translation
		}[]
	}
}

import i18next from "i18next"

export namespace AiModel {
	/** 业务类型 */
	export enum BusinessType {
		/** 服务商 */
		ServiceProvider = "service_provider",
		/** 模式 */
		Mode = "mode",
	}

	/** 文件类型 */
	export enum FileType {
		/** 官方 */
		Official = 0,
		/** 非官方 */
		NonOfficial = 1,
	}

	/** 服务商 */
	export enum ServiceProvider {
		/** 官方 */
		Official = "Official",
		/** OpenAI */
		OpenAI = "OpenAI",
		/** 微软 Azure */
		MicrosoftAzure = "MicrosoftAzure",
		/** 火山引擎 */
		Volcengine = "Volcengine",
		/** 美图奇想 */
		MiracleVision = "MiracleVision",
		/** 腾讯 */
		Tencent = "Tencent",
		/** 阿里 */
		Qwen = "Qwen",
		/** TTAPI */
		TTAPI = "TTAPI",
		/** DeepSeek */
		DeepSeek = "DeepSeek",
		/** 亚马逊 */
		AWSBedrock = "AWSBedrock",
		/** 谷歌 */
		GoogleImage = "Google-Image",
		/** 火山引擎方舟 */
		VolcengineArk = "VolcengineArk",
		/** Gemini */
		Gemini = "Gemini",
		/** 谷歌 */
		Google = "Google",
		/** 阿里百练 */
		DashScope = "DashScope",
		QwenGlobal = "QwenGlobal",
		/** OpenRouter */
		OpenRouter = "OpenRouter",
		/** 百度  */
		Baidu = "Baidu",
		/** 国家超算平台 */
		SCNet = "SCNet",
		/** Kimi平台 */
		Moonshot = "Moonshot",
		/** 硅流 */
		SiliconFlow = "SiliconFlow",
		/** 智谱AI */
		BigModel = "BigModel",
		/** MiniMax 开放平台 */
		MiniMax = "MiniMax",
	}

	/** 服务商默认 API 地址（与后端默认占位一致） */
	export const ServiceProviderUrl: Partial<Record<ServiceProvider, string>> = {
		[ServiceProvider.OpenAI]: "https://api.openai.com/v1",
		[ServiceProvider.MicrosoftAzure]: "https://docs-test-001.openai.azure.com",
		[ServiceProvider.Volcengine]: "https://ark.cn-beijing.volces.com/api/v3",
		[ServiceProvider.VolcengineArk]: "https://ark.cn-beijing.volces.com/api/v3",
		[ServiceProvider.Tencent]: "https://api.hunyuan.cloud.tencent.com/v1",
		[ServiceProvider.Qwen]: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		[ServiceProvider.DashScope]: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		[ServiceProvider.QwenGlobal]: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
		[ServiceProvider.DeepSeek]: "https://api.deepseek.com",
		[ServiceProvider.Baidu]: "https://qianfan.baidubce.com/v2",
		[ServiceProvider.SCNet]: "https://api.scnet.cn/api/llm/v1",
		[ServiceProvider.Moonshot]: "https://api.moonshot.cn/v1",
		[ServiceProvider.BigModel]: "https://open.bigmodel.cn/api/paas/v4",
		[ServiceProvider.MiniMax]: "https://api.minimaxi.com/v1",
		[ServiceProvider.SiliconFlow]: "https://api.siliconflow.cn/v1",
		[ServiceProvider.Gemini]: "https://api.gemini.com",
		[ServiceProvider.GoogleImage]: "https://api.googleimage.com",
		[ServiceProvider.OpenRouter]: "https://openrouter.ai/api/v1/chat/completions",
		[ServiceProvider.Google]: "https://generativelanguage.googleapis.com/v1beta",
	}

	/** 权限 */
	// 实际的权限枚举
	export enum OperationTypes {
		None = 0,
		Owner = 1,
		Admin = 2,
		Read = 3,
		Edit = 4,
	}

	/** 权限类型 */
	export enum PermissionType {
		/** 全部 */
		All = 1,
		/** 部分 */
		Part = 2,
	}

	/** 模型能力 */
	export enum ModelPower {
		/** 支持工具 */
		SupportTool = "1",
		/** 支持视觉识别 */
		SupportVision = "2",
		/** 支持深度思考 */
		SupportThink = "3",
	}

	/** 模型类型组 */
	export enum ModelTypeGroup {
		/** 文生图 */
		TextToImage = 0,
		/** 图生图 */
		ImageToImage = 1,
		/** 图像增强 */
		ImageEnhance = 2,
		/** 对话式模型 */
		LargeLanguageModel = 3,
		/** 嵌入式模型 */
		Embedding = 4,
	}

	/** 模型标识类型 */
	export enum ModelIdType {
		/** 官方 */
		Official = 0,
		/** 非官方 */
		NonOfficial = 1,
	}

	/** 服务商种类 */
	export enum ServiceProviderCategory {
		/** 模型管理 */
		LLM = "llm",
		/** 智能绘图管理 */
		VLM = "vlm",
	}

	/** 服务商类型 */
	export enum ProviderType {
		/** 非官方 */
		NonOfficial = 0,
		/** 官方 */
		Official = 1,
		/** 自定义 */
		Custom = 2,
	}

	/** 状态 */
	export enum Status {
		/** 未激活 */
		Disabled = 0,
		/** 已激活 */
		Enabled = 1,
	}

	/** 模型温度类型 */
	export enum ModelTemperatureType {
		/** 推荐温度 */
		Recommended = 1,
		/** 固定温度 */
		Fixed = 2,
	}

	/** 助理类型 */
	export enum AgentType {
		/** 企业助理 */
		EnterpriseAssistant = "Enterprise_assistant",
		/** 官方助理 */
		OfficialAssistant = "Official_assistant",
	}

	/** 助理状态 */
	export enum AgentStatus {
		/** 全部 */
		All = 0,
		/** 启用 */
		Enabled = 7,
		/** 禁用 */
		Disabled = 8,
	}

	/** 助理发布范围 */
	export enum ReleaseScope {
		/** 个人 */
		Personal = 0,
		/** 企业内部 */
		Enterprise = 1,
		/** 市场 */
		Market = 2,
		/** 未发布 */
		UnRelease = 3,
	}

	/** 企业发布状态 */
	export enum EnterpriseStatus {
		/** 未发布 */
		unRelease = 5,
		/** 已发布 */
		release = 6,
	}

	/** 企业发布状态映射 */
	export const EnterpriseStatusMap = {
		[EnterpriseStatus.unRelease]: i18next.t("agentConfig.unPublished", {
			ns: "admin/ai/agent",
		}),
		[EnterpriseStatus.release]: i18next.t("agentConfig.published", {
			ns: "admin/ai/agent",
		}),
	}

	/** 平台发布状态 */
	export enum PlatformStatus {
		/** 未上架 */
		unRelease = 9,
		/** 审核中 */
		audit = 10,
		/** 已上架 */
		release = 11,
	}

	/** 审批流状态 */
	export enum ApprovalStatus {
		/** 待审批 */
		Pending = 1,
		/** 审批中 */
		Inprogress = 2,
		/** 已通过 */
		Pass = 3,
		/** 已拒绝 */
		Reject = 4,
	}

	/** 审批流状态映射 */
	export const ApprovalStatusMap = {
		[ApprovalStatus.Pending]: "待审批",
		[ApprovalStatus.Inprogress]: "审批中",
		[ApprovalStatus.Pass]: "已通过",
		[ApprovalStatus.Reject]: "不通过",
	}

	/** 账户类型 */
	export enum AccountType {
		/** 用户 */
		User = 1,
		/** 部门 */
		Department = 2,
	}

	/** 审批类型 */
	export enum ApprovalType {
		/** 无需审批 */
		NoApproval = 1,
		/** 需要审批 */
		NeedApproval = 2,
	}

	/** 大模型调度类型 */
	export enum SchedulingType {
		/** 水平调度 */
		HorizontalScheduling = 1,
		/** 降级调度 */
		DowngradeScheduling = 2,
	}

	/** AI助理全局设置 */
	export enum AgentGlobalSettingType {
		/** 默认ai好友 */
		DefaultFriend = 1,
		/** 创建管理 */
		CreateManage = 2,
		/** 第三方平台发布管控 */
		ThirdPublish = 3,
	}

	/** 好友类型 */
	export enum FriendType {
		/** 已选择默认好友 */
		Selected = 1,
		/** 已发布未设置未默认好友 */
		Published = 2,
	}
}

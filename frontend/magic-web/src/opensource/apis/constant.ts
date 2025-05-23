/* eslint-disable no-template-curly-in-string */

export const enum RequestUrl {
	/** User */
	/** 获取用户账号列表 */
	getUserAccounts = "/v4/users/accounts",
	/** 获取账号管理的用户详情 */
	getUserInfo = "/v4/users/info",
	/** 获取用户设备 */
	getUserDevices = "/v4/users/login/devices",
	/** 退出设备 */
	logoutDevices = "/v4/users/logout/device",
	/** 获取验证码 */
	getUsersVerificationCode = "/v4/users/send_sms",
	/** 获取修改手机号验证码 */
	getUserVerificationCode = "/v4/user/send_sms",
	/** 修改密码 */
	changePassword = "/v4/users/pwd",
	/** 修改手机号 */
	changePhone = "/v4/users/phone",
	/** 登录 */
	Login = "/v4/user/login",
	/** 第三方登录 */
	thirdPartyLogins = "/v4/user/fast_login",

	/** 获取天书 用户信息 */
	getTeamshareUserInfo = "/v4/users/info",
	/** 获取天书 用户部门 */
	getTeamshareUserDepartments = "/api/v2/users/department",
	/** 用户说明书 */
	getUserManual = "/api/v2/magic/contact/user/user-manual",

	/** 获取全局共用配置 */
	/** 获取应用国际化语言、国际冠号 */
	getInternationalizedSettings = "/v4/locales/settings",
	/** 获取私有化环境配置 */
	getPrivateConfigure = "/v4/private-deployments/configuration",

	/** Application */
	/** 获取应用列表 */
	getAppList = "/v4/workbench/applications",
	getAppCategoriesList = "/v4/workbench/applications/categories",
	/** 获取常用应用 */
	getCommonApplications = "/v4/workbench/common/applications",
	/** 分类应用 */
	getCommonCategories = "/v4/workbench/applications/categories",
	/** 应用详情 */
	getApplicationDetails = "/v4/workbench/applications/${code}/info",

	/** Organization */

	/** Contact */
	/** 获取所有 Prompt 好友 */
	getSquarePrompts = "/api/v2/magic/friend/square",
	/** 好友广场搜索 */
	getSquareFriendsByKeyword = "/api/v2/magic/friend/search",
	/** 获取好友列表 */
	getFriends = "/api/v1/contact/friends",
	/** 添加 Prompt 好友 */
	addPropmtFriend = "/api/v1/contact/friends/${friendId}",
	/** 获取组织架构 */
	getOrganization = "/api/v1/contact/departments/${id}/children",
	/** 根据 IDs 获取所有类型用户信息 */
	getUserInfoByIds = "/api/v1/contact/users/queries",
	/** 【新版本】获取部门用户列表 */
	getDepartmentUsers = "/api/v1/contact/departments/${id}/users",
	/** 搜索用户 */
	searchUser = "/api/v1/contact/users/search",
	/** 获取部门信息 */
	getDepartmentInfo = "/api/v1/contact/departments/${id}",
	/** 模糊搜索部门列表 */
	searchOrganizations = "/api/v1/contact/departments/search",
	/** 获取天书 userId */
	getTeamshareUserId = "/api/v1/users/me/teamshare-id",
	/** 获取部门说明书 */
	getDepartmentDocument = "/api/v1/departments/${id}/document",

	/** Chat */
	/** 拉取离线消息 */
	messagePull = "/api/v1/im/messages/page",
	/** 拉取最近消息 */
	messagePullCurrent = "/api/v1/im/messages",
	/** 获取会话列表  */
	getConversationList = "/api/v1/im/conversations/queries",
	/** 会话窗口操作（移除，免打扰，置顶，红标等） */
	handleConversation = "/magic_friend/add",
	/** 创建群聊 */
	createGroupConversation = "/api/v1/contact/groups",
	/** 获取群聊详情 */
	getGroupConversationDetail = "/api/v1/contact/groups/queries",
	/** 获取群聊成员 */
	getGroupConversationMembers = "/api/v1/contact/groups/${id}/members",
	/** 获取用户群组 */
	getUserGroups = "/api/v1/contact/users/self/groups",
	/** 获取消息接收者列表 */
	getMessageReceiveList = "/api/v1/im/messages/${messageId}/recipients",
	/** 添加群组成员 */
	addGroupUsers = "/api/v1/contact/groups/${id}/members",
	/** 退出群聊 */
	leaveGroup = "/api/v1/contact/groups/${id}/members/self",
	/** 踢出群聊 */
	kickGroupUsers = "/api/v1/contact/groups/${id}/members",
	/** 解散群聊 */
	removeGroup = "/api/v1/contact/groups/${id}",
	/** 更新群信息 */
	updateGroupInfo = "/api/v1/contact/groups/${id}",
	/** 根据 IDs 获取所有类型会话信息 */
	getConversationInfoByIds = "/api/v1/im/conversations/queries",
	/** 获取聊天文件url */
	getChatFileUrls = "/api/v1/im/files/download-urls/queries",
	/** 获取AI 总结消息 */
	getConversationAiAutoCompletion = "/api/v1/im/conversations/${conversationId}/completions",
	/** 获取 AI助理对应的机器人信息 */
	getAiAssistantBotInfo = "/api/v1/agents/versions/${userId}/user",
	/** 更新 AI助理 快捷指令配置 */
	updateAiConversationQuickInstructionConfig = "/api/v1/im/conversations/${conversationId}/instructs",
	/** 获取指定会话下的消息 */
	getConversationMessages = "/api/v1/im/conversations/${conversationId}/messages/queries",
	/** 根据应用消息ID获取消息 */
	getMessagesByAppMessageId = "/api/v1/messages/app-message-ids/${appMessageId}/queries",

	/**
	 * 批量拉取指定会话下的消息
	 * @deprecated 接口行为不符合预期，准备废弃
	 */
	batchGetConversationMessages = "/api/v1/im/conversations/${conversationId}/messages",
	/** 批量拉取指定会话下的多条消息 */
	batchGetConversationMessagesV2 = "/api/v1/im/conversations/messages/queries",
	/** 【新版本】查询用户任务列表 */
	getTaskList = "/api/v1/user/task",
	/** 【新版本】创建用户任务 */
	createTask = "/api/v1/user/task",
	/** 【新版本】获取用户任务 */
	getTask = "/api/v1/user/task/${id}",

	/** File */
	/** 检查文件上传状态 */
	checkFileUploadStatus = "/api/v1/file-utils/upload-verifications",
	/** 获取上传凭证 */
	getUploadCredentials = "/api/v1/file/temporary-credential",
	/** 上报文件上传 */
	reportFileUpload = "/api/v1/im/files",
	/** 获取文件下载链接 */
	getFileDownloadLink = "/api/v1/file/publicFileDownload",

	/** Drive */
	/** 获取文件列表 */
	getFileList = "/api/v2/files/cascade/queries",
	/** 获取文件详情 */
	getFileDetail = "/api/anonymous/v2/files/${fileId}",
	/** 获取收藏文件列表 */
	getFavoriteList = "/api/v1/favorites/queries",
	/** 获取最近使用列表 */
	getRecentFileList = "/api/v1/recent_files/queries",
	/** 添加/取消收藏 */
	addOrCancelFavorite = "/api/v1/favorites",
	/** 获取上传文件信息 */
	getUploadFileInfo = "/api/wps/url/queries",
	/** 编辑文件 */
	editFile = "/api/v1/files/${id}",
	/** 删除文件 */
	trashFile = "/api/v1/trashes",
	/* 获取回收站文件 */
	getTrashFiles = "/api/v2/trashes/queries",
	/** 创建副本文件 */
	duplicateFile = "/api/v1/files/${fileId}/duplication",
	/** 创建文件 */
	newFile = "/api/v1/files",
	/** 文件权限列表 */
	getFilePermissions = "/api/v1/files/${fileId}/permissions",
	/** 文件移动 */
	moveFileTo = "/api/v1/file_movements",
	/** 获取模板库目录 */
	getTemplateLibraryCategories = "/api/v1/template_library/categories",
	/* 获取模板库文件列表 */
	getTemplateLibraryFiles = "/api/v1/template_library",
	/** 获取模板库文件封面图 */
	getFileCdnUrl = "/api/v1/file-utils/temporary-urls/queries",
	/** 云盘内文件搜索 */
	searchFiles = "/open/oauth/home/search",

	/** Flow */
	/** 获取工作流列表 */
	getFlowList = "/api/v1/flows/queries",
	/** 流程试运行 */
	testFlow = "/api/v1/flows/${flowId}/flow-debug",
	/** 新增流程/修改流程 */
	addOrUpdateFlowBaseInfo = "/api/v1/flows",
	/** 保存流程详情 */
	saveFlow = "/api/v1/flows/${flowId}/save-node",
	/** 获取流程详情 */
	getFlow = "/api/v1/flows/${flowId}",
	/** 删除流程 */
	deleteFlow = "/api/v1/flows/${flowId}",
	/** 修改流程启用状态 */
	changeEnableStatus = "/api/v1/flows/${flowId}/change-enable",
	/** 单点调试 */
	testNode = "/api/v1/flows/node-debug",
	/** 获取可用 LLM 模型 */
	getLLMModal = "/api/v1/flows/models",
	/** 获取当前用户可绑定的开放平台应用列表 */
	getOpenPlatformOfMine = "/api/v1/flows/open-platform/applications",
	/** 给指定工作流添加开放平台应用 */
	bindOpenApiAccount = "/api/v1/flows/${flowId}/open-platform/apps",
	/** 移除指定工作流的开放平台应用 */
	removeOpenApiAccount = "/api/v1/flows/${flowId}/open-platform/apps",
	/** 获取指定工作流绑定的开放平台应用列表 */
	getOpenApiAccountList = "/api/v1/flows/${flowId}/open-platform/apps/queries",
	/** 获取子流程的入参和出参 */
	getSubFlowArgument = "/api/v1/flows/${flowId}/params",
	/** 保存流程草稿 */
	saveFlowDraft = "/api/v1/flows/${flowId}/draft",
	/** 获取流程草稿列表 */
	getFlowDraftList = "/api/v1/flows/${flowId}/draft/queries",
	/** 查询流程草稿详情 */
	getFlowDratDetail = "/api/v1/flows/${flowId}/draft/${draftId}",
	/** 删除流程草稿 */
	deleteFlowDraft = "/api/v1/flows/${flowId}/draft/${draftId}",

	/** 获取工具集列表 */
	getToolList = "/api/v1/flows/tool-set/queries",
	/** 获取可用的工具集列表 */
	getUseableToolList = "/api/v1/flows/queries/tool-sets",
	/** 获取工具集详情 */
	getTool = "/api/v1/flows/tool-set/${id}",
	/** 保存工具集 */
	saveTool = "/api/v1/flows/tool-set",
	/** 删除工具集 */
	deleteTool = "/api/v1/flows/tool-set/${id}",
	/** 获取可用的工具列表 */
	getAvailableTools = "/api/v1/flows/queries/tools",
	/** 创建 / 更新 MCP  */
	saveMcp = "/api/v1/mcp/server",
	/** 获取 MCP 列表 */
	getMcpList = "/api/v1/mcp/server/queries",
	/** 获取 MCP 详情 */
	getMcp = "/api/v1/mcp/server/${id}",
	/** 删除 MCP */
	deleteMcp = "/api/v1/mcp/server/${id}",
	/** 获取 MCP 的工具列表 */
	getMcpToolList = "/api/v1/mcp/server/${code}/tools",
	/** 保存 MCP 的工具 */
	saveMcpTool = "/api/v1/mcp/server/${code}/tool",
	/** 删除 MCP 的工具 */
	deleteMcpTool = "/api/v1/mcp/server/${code}/tool/${id}",
	/** 获取 MCP 的工具详情 */
	getMcpToolDetail = "/api/v1/mcp/server/${code}/tool/${id}",
	/** 获取函数表达式数据源 */
	getMethodsDataSource = "/api/v1/flows/expression-data-source",
	/** 获取可用的知识库列表 */
	getUseableDatabaseList = "/api/v1/flows/queries/knowledge",
	/** 获取可用的天书知识库列表 */
	getUseableTeamshareDatabaseList = "/api/v1/teamshare/knowledge/manageable",
	/** 获取视觉理解模型数据源 */
	getVisionModels = "/org/admin/service-providers/category",
	/** 根据类型获取所有激活模型 */
	getActiveModelByCategory = "/api/v1/admin/service-providers/by-category",
	/** 获取官方重排模型列表 */
	getRerankModels = "/api/v1/knowledge-base/providers/rerank/list",
	/** 获取知识库向量化进度 */
	getTeamshareKnowledgeProgress = "/api/v1/teamshare/knowledge/manageable-progress",
	/** 发起知识库的向量创建 */
	createTeamshareKnowledgeVector = "/api/v1/teamshare/knowledge/start-vector",
	/** Api Key 调用 Agent */
	callAgent = "/api/chat",
	/** Api Key 调用工具或流程  */
	callToolOrFlow = "/api/param-call",
	/** 获取节点模板 */
	getNodeTemplate = "/api/v1/flows/node-template",

	/** 发布流程版本 */
	publishFlow = "/api/v1/flows/${flowId}/version/publish",
	/** 回滚流程版本 */
	restoreFlow = "/api/v1/flows/${flowId}/version/${versionId}/rollback",
	/** 查询版本列表 */
	getFlowPublishList = "/api/v1/flows/${flowId}/version/queries?page=${page}&page_size=${pageSize}",
	/** 查询版本详情 */
	getFlowPublishDetail = "/api/v1/flows/${flowId}/version/${versionId}",

	/** Knowledge */
	/** 创建知识库 */
	createKnowledge = "/api/v1/knowledge-bases",
	/** 更新知识库 */
	updateKnowledge = "/api/v1/knowledge-bases/${code}",
	/** 知识库列表 */
	getKnowledgeList = "/api/v1/knowledge-bases/queries",
	/** 保存知识库 */
	saveKnowledge = "/api/v2/magic/knowledge",
	/** 知识库详情 */
	getKnowLedgeDetail = "/api/v1/knowledge-bases/${code}",
	/** 知识库移除 */
	deleteKnowledge = "/api/v1/knowledge-bases/${code}",
	/** 知识库匹配 */
	matchKnowledge = "/api/v1/knowledge-bases/similarity",
	/** 获取知识库的文档列表 */
	getKnowledgeDocumentList = "/api/v1/knowledge-bases/${code}/documents/queries",
	/** 添加知识库的文档 */
	addKnowledgeDocument = "/api/v1/knowledge-bases/${code}/documents",
	/** 获取知识库的文档详情 */
	getKnowledgeDocumentDetail = "/api/v1/knowledge-bases/${knowledge_code}/documents/${document_code}",
	/** 更新知识库的文档 */
	updateKnowledgeDocument = "/api/v1/knowledge-bases/${knowledge_code}/documents/${document_code}",
	/** 删除知识库的文档 */
	deleteKnowledgeDocument = "/api/v1/knowledge-bases/${knowledge_code}/documents/${document_code}",
	/** 分段预览 */
	segmentPreview = "/api/v1/knowledge-bases/fragments/preview",
	/** 召回测试 */
	recallTest = "/api/v1/knowledge-bases/${knowledge_code}/fragments/similarity",
	/** 获取嵌入模型列表 */
	getEmbeddingModelList = "/api/v1/knowledge-bases/providers/embedding/list",
	/** 片段列表 */
	getFragmentList = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments/queries",
	/** 文档重新向量化 */
	revectorizeDocument = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/re-vectorized",
	/** 创建片段 */
	createFragment = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments",
	/** 更新片段 */
	updateFragment = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments/${id}",
	/** 片段详情 */
	getFragmentDetail = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments/${id}",
	/** 片段删除 */
	deleteFragment = "/api/v1/knowledge-bases/${knowledge_base_code}/documents/${document_code}/fragments/${id}",
	/** 知识库重建 - 待废弃 */
	rebuildKnowledge = "/api/v2/magic/knowledge/${id}/rebuild",

	/** 保存 api-key */
	saveApiKey = "/api/v1/flows/${flowId}/api-key",
	/** 查询 api-key 列表 */
	getApiKeyList = "/api/v1/flows/${flowId}/api-key/queries",
	/** 查询 api-key 详情 */
	getApiKeyDetail = "/api/v1/flows/${flowId}/api-key/${id}",
	/** 删除 api-key  */
	deleteApiKey = "/api/v1/flows/${flowId}/api-key/${id}",
	/** 重建 api-key */
	rebuildApiKey = "/api/v1/flows/${flowId}/api-key/${id}/rebuild",

	/** 保存 api-key v1 */
	saveApiKeyV1 = "/api/v1/authentication/api-key",
	/** 查询 api-key v1 */
	getApiKeyListV1 = "/api/v1/authentication/api-key/queries",
	/** 查询 api-key v1 详情 */
	getApiKeyDetailV1 = "/api/v1/authentication/api-key/${code}",
	/** 删除 api-key v1 */
	deleteApiKeyV1 = "/api/v1/authentication/api-key/${code}",
	/** 重建 api-key v1 */
	rebuildApiKeyV1 = "/api/v1/authentication/api-key/${code}/rebuild",

	/** 获取话题列表 */
	getTopicList = "/api/v1/im/conversations/${conversationId}/topics/queries",
	/** 获取话题消息 */
	getTopicMessages = "/api/v2/magic/topic/messages",
	/** 话题智能重命名 */
	getMagicTopicName = "/api/v1/im/conversations/${conversationId}/topics/${topicId}/name",

	
	/** 获取文件 */
	getFiles = "/api/v1/teamshare/multi-table/file/queries",
	/** 获取数据表 */
	getSheets = "/api/v1/teamshare/multi-table/${fileId}/sheets",
	/** 获取文件详情 */
	getFile = "/api/v1/teamshare/multi-table/${fileId}",
    

	/** Auth */
	/** 更新资源授权 */
	updateResourceAccess = "/api/v1/operation-permissions/resource-access",
	/** 查询资源授权 */
	getResourceAccess = "/api/v1/operation-permissions/resource-access",
	/** 转让创建人 */
	transferOwner = "/api/v1/operation-permissions/transfer-owner",
	/** magic 中绑定 Authorization + 授权码 */
	bindMagicAuthorization = "/api/v1/auth/status",
	/** 【新版本】用户 Token 换取一次性临时授权 Token */
	userTokenToTempToken = "/api/v1/auth/temp-token",
	/** 【新版本】临时授权 Token 换取用户 Token */
	tempTokenToUserToken = "/api/v1/auth/teamshare-token?temp_token=${tempToken}",
	/** 根据当前账号获取环境 code */
	getDeploymentCode = "/api/v1/auth/environment",
	/** 获取管理后台权限 */
	getAdminPermission = "/api/v1/magic/operation-permissions/organization-admin",

	/** bots */
	/** 获取市场机器人 */
	getMarketBotList = "/api/v1/agents/versions/marketplace",
	/** 获取企业内部机器人列表 */
	getOrgBotList = "/api/v1/agents/versions/organization",
	/** 获取用户个人机器人列表 */
	getUserBotList = "/api/v1/agents/queries",
	/** 保存机器人 */
	saveBot = "/api/v1/agents",
	/** 机器人详情 */
	getBotDetail = "/api/v1/agents/${agentId}",
	/** 删除机器人 */
	deleteBot = "/api/v1/agents/${agentId}",
	/** 获取机器人版本列表 */
	getBotVersionList = "/api/v1/agents/${agentId}/versions",
	/** 获取发布机器人版本详情 */
	getBotVersionDetail = "/api/v1/agents/versions/${agentVersionId}",
	/** 修改机器人状态 */
	updateBotStatus = "/api/v1/agents/${agentId}/status",
	/** 发布机器人 */
	publishBot = "/api/v1/agents/versions",
	/** 机器人最大版本 */
	getBotMaxVersion = "/api/v1/agents/${agentId}/max",
	/** 机器人发布至组织 */
	publishBotToOrg = "/api/v1/agents/${agentId}/enterprise-status",
	/** 机器人注册并添加好友 */
	registerAndAddFriend = "/api/v1/agents/${agentVersionId}/register-friend",
	/** 机器人是否修改过 */
	isBotUpdate = "/api/v1/agents/${agentId}/is-updated",
	/** 获取默认图标 */
	getDefaultIcon = "/api/v1/file/default-icons",
	/** 保存交互指令 */
	saveInstruct = "/api/v1/agents/${agentId}/instructs",
	/** 获取交互指令类型 */
	getInstructTypeOption = "/api/v1/agent-options/instruct-types",
	/** 获取交互指令组类型 */
	getInstructGroupTypeOption = "/api/v1/agent-options/instruct-group-types",
	/** 获取交互指令状态类型icon */
	getInstructStatusIcons = "/api/v1/agent-options/instruct-state-icons",
	/** 获取交互指令状态类型颜色组 */
	getInstructStatusColors = "/api/v1/agent-options/instruct-state-colors",
	/** 获取系统指令 */
	getSystemInstruct = "/api/v1/agent-options/instruct-system",
	/** 获取配置过的第三方平台列表 */
	getThirdPartyPlatforms = "/api/v1/agents/third-platform/${botId}/list",

	/** calendar */
	/** 创建日程 */
	createCalendar = "/api/v1/schedules",
	/** 创建ai日程 - 暂无v1 */
	createAiCalendar = "/api/v2/magic/meetingrooms/schedules/ai-create-template",
	/** 获取日程详情 */
	getCalendarDetail = "/api/v1/schedules/${id}",
	/** 获取指定天的日程安排 */
	getCalendarByDay = "/api/v2/magic/meetingrooms/schedules/queries",
	/** 更新日程 */
	updateCalendar = "/api/v1/schedules",
	/** 更新日程的邀请状态 */
	updateCalendarStatus = "/api/v1/schedules/${id}/participants",
	/** 删除日程 */
	deleteCalendar = "/api/v1/schedules/${id}",
	/** 获取日程纪要 */
	getCalendarSummary = "/api/v1/schedules/${id}/summary",
	/** 评论日程 */
	commentCalendar = "/api/v1/schedules/${id}/comments",
	/** 添加邀请人 */
	addParticipant = "/api/v1/schedules/${id}/participants",
	/** 获取用户闲忙状态 */
	getUserStatus = "/api/v1/schedules/user/availability",
	/** 获取日程的邀请人的状态 */
	getParticipantAvaliablity = "/api/v1/schedules/${id}/participants",
	/** 转让日程组织者 */
	transferOrganizer = "/api/v1/schedules/${id}/owner",
	/** 获取会议室列表 */
	getMeetingRooms = "/api/v1/meeting-rooms",
	/** 获取指定时间段的可预约会议室 */
	getAvaliableMeetingRooms = "/api/v1/meeting-rooms/available",
	/** 会议室获取筛选条件 */
	getFilteringCriteria = "/api/v1/meeting-rooms/locations",
	/** 根据日程创建群聊 */
	createCalendarGroup = "/api/v1/schedules/${id}/chat-groups",

	/** favorites */
	/** 收藏 */
	/** 添加收藏 */
	addFavorites = "/api/v1/favorites",
	/** 删除收藏 */
	deleteFavorites = "/api/v1/favorites",
	/** 搜索收藏 */
	searchFavorites = "/api/v1/favorites/search",
	/** 获取收藏列表 */
	getFavorites = "/api/v1/favorites/list/queries",

	/** 关联标签 */
	relationLabel = "/api/v1/tags/relations",
	/** 添加标签 */
	addLabel = "/api/v1/tags",
	/** 删除标签 */
	deleteLabel = "/api/v1/tags",
	/** 编辑标签 */
	editLabel = "/api/v1/tags/${id}",
	/** 获取标签列表 */
	getLabelList = "/api/v1/tags",

	/** 审批 */
	/** 发起审批 */
	StartApproval = "/api/oa-approval/instances/start",

	/** 全局搜索 */
	globalSearch = "/api/v1/global-search/queries",
}

export const enum RequestMethod {
	GET = "GET",
	POST = "POST",
	DELETE = "DELETE",
	PUT = "PUT",
}

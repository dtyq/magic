package constants

const (
	// MethodPing 健康检查
	MethodPing = "ipc.ping"
	// MethodHello IPC 握手
	MethodHello = "ipc.hello"

	// MethodKnowledgeBaseCreate 创建知识库
	MethodKnowledgeBaseCreate = "svc.knowledge.knowledgeBase.create"
	// MethodKnowledgeBaseUpdate 更新知识库
	MethodKnowledgeBaseUpdate = "svc.knowledge.knowledgeBase.update"
	// MethodKnowledgeBaseSaveProcess 更新知识库向量化进度
	MethodKnowledgeBaseSaveProcess = "svc.knowledge.knowledgeBase.saveProcess"
	// MethodKnowledgeBaseShow 查询知识库详情
	MethodKnowledgeBaseShow = "svc.knowledge.knowledgeBase.show"
	// MethodKnowledgeBaseList 查询知识库列表
	MethodKnowledgeBaseList = "svc.knowledge.knowledgeBase.queries"
	// MethodKnowledgeBaseLinkAgentKnowledgeBases 关联数字员工知识库
	MethodKnowledgeBaseLinkAgentKnowledgeBases = "svc.knowledge.knowledgeBase.linkAgentKnowledgeBases"
	// MethodKnowledgeBaseUnlinkAgentKnowledgeBases 取消关联数字员工知识库
	MethodKnowledgeBaseUnlinkAgentKnowledgeBases = "svc.knowledge.knowledgeBase.unlinkAgentKnowledgeBases"
	// MethodKnowledgeBaseUpdateAgentKnowledgeBaseBinding 更新数字员工知识库绑定配置
	MethodKnowledgeBaseUpdateAgentKnowledgeBaseBinding = "svc.knowledge.knowledgeBase.updateAgentKnowledgeBaseBinding"
	// MethodKnowledgeBaseDestroy 删除知识库
	MethodKnowledgeBaseDestroy = "svc.knowledge.knowledgeBase.destroy"
	// MethodKnowledgeBaseRebuild 重建知识库向量
	MethodKnowledgeBaseRebuild = "svc.knowledge.knowledgeBase.rebuild"
	// MethodKnowledgeBaseRebuildStatus 查询知识库重建状态
	MethodKnowledgeBaseRebuildStatus = "svc.knowledge.knowledgeBase.rebuildStatus"
	// MethodKnowledgeBaseSwitchEmbeddingModelMeta 切换知识库嵌入模型元数据
	MethodKnowledgeBaseSwitchEmbeddingModelMeta = "svc.knowledge.knowledgeBase.switchEmbeddingModelMeta"
	// MethodKnowledgeBaseRepairSourceBindings 修复历史来源绑定
	MethodKnowledgeBaseRepairSourceBindings = "svc.knowledge.knowledgeBase.repairThirdFileMappings"
	// MethodKnowledgeBaseRebuildCleanup 清理重建残留集合
	MethodKnowledgeBaseRebuildCleanup = "svc.knowledge.knowledgeBase.rebuildCleanup"
	// MethodKnowledgeBaseNodes 查询来源绑定选择器节点
	MethodKnowledgeBaseNodes = "svc.knowledge.knowledgeBase.nodes"
	// MethodKnowledgeTeamshareStartVector Teamshare 触发知识库向量化
	MethodKnowledgeTeamshareStartVector = "svc.knowledge.teamshare.startVector"
	// MethodKnowledgeTeamshareManageable Teamshare 查询当前用户可管理知识库
	MethodKnowledgeTeamshareManageable = "svc.knowledge.teamshare.manageable"
	// MethodKnowledgeTeamshareManageableProgress Teamshare 查询知识库向量化进度
	MethodKnowledgeTeamshareManageableProgress = "svc.knowledge.teamshare.manageableProgress"
	// MethodKnowledgeBasePermissionListOperations 回调 PHP 批量查询当前用户对知识库的操作权限
	MethodKnowledgeBasePermissionListOperations = "svc.knowledge.knowledgeBasePermission.listOperations"
	// MethodKnowledgeBasePermissionInitialize 回调 PHP 初始化知识库 owner/admin 权限
	MethodKnowledgeBasePermissionInitialize = "svc.knowledge.knowledgeBasePermission.initialize"
	// MethodKnowledgeBasePermissionGrantOwner 回调 PHP 显式授予知识库 owner 权限
	MethodKnowledgeBasePermissionGrantOwner = "svc.knowledge.knowledgeBasePermission.grantOwner"
	// MethodKnowledgeBasePermissionCleanup 回调 PHP 清理知识库权限
	MethodKnowledgeBasePermissionCleanup = "svc.knowledge.knowledgeBasePermission.cleanup"
	// MethodKnowledgeBasePermissionCheckOfficialOrganizationMember 回调 PHP 校验是否为官方组织
	MethodKnowledgeBasePermissionCheckOfficialOrganizationMember = "svc.knowledge.knowledgeBasePermission.checkOfficialOrganizationMember"
	// MethodKnowledgeBaseRebuildPermissions 补齐知识库权限
	MethodKnowledgeBaseRebuildPermissions = "svc.knowledge.knowledgeBase.rebuildPermissions"
	// MethodSocketIORedisCleanup 异步清理允许的 Socket.IO Redis key 前缀
	MethodSocketIORedisCleanup = "svc.socketio.redis.cleanup"

	// MethodFragmentCreate 创建片段
	MethodFragmentCreate = "svc.knowledge.fragment.create"
	// MethodFragmentShow 查询片段详情
	MethodFragmentShow = "svc.knowledge.fragment.show"
	// MethodFragmentList 查询片段列表
	MethodFragmentList = "svc.knowledge.fragment.queries"
	// MethodFragmentListHTTP 查询片段列表并返回最终 HTTP body
	MethodFragmentListHTTP = "svc.knowledge.fragment.queries_http"
	// MethodFragmentDestroy 删除片段
	MethodFragmentDestroy = "svc.knowledge.fragment.destroy"
	// MethodFragmentSync 同步片段
	MethodFragmentSync = "svc.knowledge.fragment.sync"
	// MethodFragmentSimilarity 片段相似度搜索
	MethodFragmentSimilarity = "svc.knowledge.fragment.similarity"
	// MethodFragmentSimilarityHTTP 片段相似度搜索并返回最终 HTTP body
	MethodFragmentSimilarityHTTP = "svc.knowledge.fragment.similarity_http"
	// MethodFragmentRuntimeSimilarity flow/teamshare runtime 多知识库相似度搜索
	MethodFragmentRuntimeSimilarity = "svc.knowledge.fragment.runtimeSimilarity"
	// MethodFragmentSimilarityByAgent 数字员工维度片段相似度搜索
	MethodFragmentSimilarityByAgent = "svc.knowledge.fragment.similarityByAgent"
	// MethodFragmentFlowVectorSimilarityByUser 用户维度 flow 知识库相似度搜索
	MethodFragmentFlowVectorSimilarityByUser = "svc.knowledge.fragment.flowVectorSimilarityByUser"
	// MethodFragmentRuntimeCreate flow/teamshare runtime 片段写入
	MethodFragmentRuntimeCreate = "svc.knowledge.fragment.runtimeCreate"
	// MethodFragmentRuntimeDestroyByBusinessID flow/teamshare runtime 按 business_id 删片段
	MethodFragmentRuntimeDestroyByBusinessID = "svc.knowledge.fragment.runtimeDestroyByBusinessId"
	// MethodFragmentRuntimeDestroyByMetadataFilter flow/teamshare runtime 按 metadata filter 删片段
	MethodFragmentRuntimeDestroyByMetadataFilter = "svc.knowledge.fragment.runtimeDestroyByMetadataFilter"
	// MethodFragmentPreview 片段预览
	MethodFragmentPreview = "svc.knowledge.fragment.preview"
	// MethodFragmentPreviewHTTP 片段预览并返回最终 HTTP body
	MethodFragmentPreviewHTTP = "svc.knowledge.fragment.preview_http"

	// MethodEmbeddingCompute 计算 Embedding
	MethodEmbeddingCompute = "svc.knowledge.embedding.compute"
	// MethodEmbeddingComputeBatch 批量计算 Embedding
	MethodEmbeddingComputeBatch = "svc.knowledge.embedding.computeBatch"
	// MethodEmbeddingProvidersList 获取 Embedding Providers
	MethodEmbeddingProvidersList = "svc.modelGateway.embedding.providers.list"
	// MethodModelGatewayEmbeddingCompute 回调 PHP 计算 Embedding
	MethodModelGatewayEmbeddingCompute = "svc.modelGateway.embedding.compute"
	// MethodModelGatewayEmbeddingProvidersList 回调 PHP 获取 providers
	MethodModelGatewayEmbeddingProvidersList = "svc.modelGateway.embedding.providers.list"
	// MethodModelGatewayAccessTokenGet 回调 PHP 获取 access token
	MethodModelGatewayAccessTokenGet = "svc.modelGateway.accessToken.get"
	// MethodModelGatewayModelConfigGet 回调 PHP 获取模型调用配置
	MethodModelGatewayModelConfigGet = "svc.modelGateway.model.config.get"
	// MethodAIAbilityConfigGet 回调 PHP 获取 AI 能力配置
	MethodAIAbilityConfigGet = "svc.aiAbility.config.get"
	// MethodAuthWebAuthAuthenticate 回调 PHP 校验 Web 登录态
	MethodAuthWebAuthAuthenticate = "svc.auth.webAuth.authenticate"

	// MethodKnowledgeThirdPlatformDocumentResolve 回调 PHP 解析第三方文档内容
	MethodKnowledgeThirdPlatformDocumentResolve = "svc.knowledge.thirdPlatformDocument.resolve"
	// MethodKnowledgeThirdPlatformDocumentResolveNode 回调 PHP 解析第三方单文件元信息
	MethodKnowledgeThirdPlatformDocumentResolveNode = "svc.knowledge.thirdPlatformDocument.resolveNode"
	// MethodKnowledgeThirdPlatformDocumentExpand 回调 PHP 展开第三方来源文件集合
	MethodKnowledgeThirdPlatformDocumentExpand = "svc.knowledge.thirdPlatformDocument.expand"
	// MethodKnowledgeThirdPlatformDocumentListKnowledgeBases 回调 PHP 列出可绑定企业知识库
	MethodKnowledgeThirdPlatformDocumentListKnowledgeBases = "svc.knowledge.thirdPlatformDocument.listKnowledgeBases"
	// MethodKnowledgeThirdPlatformDocumentListTreeNodes 回调 PHP 列出企业知识库树节点
	MethodKnowledgeThirdPlatformDocumentListTreeNodes = "svc.knowledge.thirdPlatformDocument.listTreeNodes"
	// MethodKnowledgeProjectFileResolve 回调 PHP 解析项目文件内容
	MethodKnowledgeProjectFileResolve = "svc.knowledge.projectFile.resolve"
	// MethodKnowledgeProjectFileListByProject 回调 PHP 列出项目叶子文件
	MethodKnowledgeProjectFileListByProject = "svc.knowledge.projectFile.listByProject"
	// MethodKnowledgeProjectFileListWorkspaces 回调 PHP 列出当前用户可见工作区
	MethodKnowledgeProjectFileListWorkspaces = "svc.knowledge.projectFile.listWorkspaces"
	// MethodKnowledgeProjectFileListProjects 回调 PHP 列出工作区下项目
	MethodKnowledgeProjectFileListProjects = "svc.knowledge.projectFile.listProjects"
	// MethodKnowledgeProjectFileListTreeNodes 回调 PHP 列出项目树节点
	MethodKnowledgeProjectFileListTreeNodes = "svc.knowledge.projectFile.listTreeNodes"
	// MethodKnowledgeProjectFileMeta 回调 PHP 获取项目文件轻量访问元信息
	MethodKnowledgeProjectFileMeta = "svc.knowledge.projectFile.meta"
	// MethodKnowledgeProjectFileGetLink 回调 PHP 获取项目文件访问链接
	MethodKnowledgeProjectFileGetLink = "svc.knowledge.projectFile.getLink"
	// MethodKnowledgeProjectFileNotifyChange PHP 通知 Go 项目文件有变更
	MethodKnowledgeProjectFileNotifyChange = "svc.knowledge.projectFile.notifyChange"
	// MethodKnowledgeOCRConfig 回调 PHP 获取 OCR 配置真值
	MethodKnowledgeOCRConfig = "svc.knowledge.ocr.config"
	// MethodKnowledgeOCRReportUsage 回调 PHP 上报 OCR 识别用量
	MethodKnowledgeOCRReportUsage = "svc.knowledge.ocr.reportUsage"
	// MethodKnowledgeSuperMagicAgentListManageableCodes 回调 PHP 批量校验当前用户可管理的数字员工
	MethodKnowledgeSuperMagicAgentListManageableCodes = "svc.knowledge.superMagicAgent.listManageableCodes"
	// MethodKnowledgeSuperMagicAgentListAccessibleCodes 回调 PHP 批量校验当前用户可访问的数字员工
	MethodKnowledgeSuperMagicAgentListAccessibleCodes = "svc.knowledge.superMagicAgent.listAccessibleCodes"
	// MethodFileGetLink 回调 PHP 文件服务获取访问链接
	MethodFileGetLink = "svc.file.getLink"
	// MethodFileStat 回调 PHP 文件服务检查对象是否存在
	MethodFileStat = "svc.file.stat"
	// MethodMagicFSFileAuthorizeFileViewer 回调 PHP 校验 MagicFS 文件 viewer 访问权限
	MethodMagicFSFileAuthorizeFileViewer = "svc.magicfs.file.authorizeFileViewer"

	// MethodDocumentCreate 创建文档
	MethodDocumentCreate = "svc.knowledge.document.create"
	// MethodDocumentUpdate 更新文档
	MethodDocumentUpdate = "svc.knowledge.document.update"
	// MethodDocumentShow 查询文档详情
	MethodDocumentShow = "svc.knowledge.document.show"
	// MethodDocumentList 查询文档列表
	MethodDocumentList = "svc.knowledge.document.queries"
	// MethodDocumentGetByThirdFileID 按第三方文件查询文档
	MethodDocumentGetByThirdFileID = "svc.knowledge.document.getByThirdFileId"
	// MethodDocumentGetOriginalFileLink 获取文档原始文件访问链接
	MethodDocumentGetOriginalFileLink = "svc.knowledge.document.getOriginalFileLink"
	// MethodDocumentCountByKnowledgeBaseCodes 按知识库批量统计文档数量
	MethodDocumentCountByKnowledgeBaseCodes = "svc.knowledge.document.countByKnowledgeBaseCodes"
	// MethodDocumentDestroy 删除文档
	MethodDocumentDestroy = "svc.knowledge.document.destroy"
	// MethodDocumentSync 同步文档
	MethodDocumentSync = "svc.knowledge.document.sync"
	// MethodDocumentReVectorizedByThirdFileID 按第三方文件触发文档重向量化
	MethodDocumentReVectorizedByThirdFileID = "svc.knowledge.document.reVectorizedByThirdFileId"
)

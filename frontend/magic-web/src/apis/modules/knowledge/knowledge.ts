import type { VectorKnowledge, WithPage } from "@/types/flow"
import type { Knowledge } from "@/types/knowledge"
import type { CrewKnowledge } from "@/types/crew-knowledge"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import type {
	GetSourceBindingNodesParams,
	SourceBindingNodesResponse,
} from "@/types/source-binding"

import { knowledgeType } from "@/pages/vectorKnowledge/constant"

export const generateKnowledgeApi = (fetch: ServiceHttpClient) => ({
	/**
	 * 创建知识库
	 */
	createKnowledge(params: Knowledge.CreateKnowledgeParams) {
		return fetch.post<Knowledge.CreateKnowledgeResult>("/api/v1/knowledge-bases", params)
	},

	/**
	 * 创建知识库 (Crew专用)
	 */
	createCrewKnowledge(params: CrewKnowledge.CreateKnowledgeParams) {
		return fetch.post<Knowledge.CreateKnowledgeResult>("/api/v1/knowledge-bases", params)
	},

	/**
	 * 更新知识库
	 */
	updateKnowledge(params: Knowledge.UpdateKnowledgeParams) {
		return fetch.put<Knowledge.Detail>(`/api/v1/knowledge-bases/${params.code}`, params)
	},

	/**
	 * 更新知识库 (Crew专用)
	 */
	updateCrewKnowledge(params: CrewKnowledge.UpdateKnowledgeParams) {
		return fetch.put<CrewKnowledge.Detail>(`/api/v1/knowledge-bases/${params.code}`, params)
	},

	/**
	 * 获取知识库列表(旧版)
	 */
	getKnowledgeList({
		name,
		page,
		pageSize,
		searchType,
		type,
	}: {
		name: string
		page: number
		pageSize: number
		searchType: VectorKnowledge.SearchType
		type?: knowledgeType
	}) {
		return fetch.post<WithPage<Knowledge.KnowledgeItem[]>>(
			"/api/v1/knowledge-bases/queries",
			{
				name,
				page,
				page_size: pageSize,
				search_type: searchType,
				type,
			},
			{ enableRequestUnion: true },
		)
	},

	/**
	 * 获取知识库列表(新版 - Crew专用)
	 */
	getCrewKnowledgeList({
		name = "",
		agent_codes,
		page,
		pageSize,
	}: {
		name?: string
		agent_codes?: string[]
		page?: number
		pageSize?: number
	}) {
		return fetch.post<WithPage<CrewKnowledge.KnowledgeItem[]>>(
			"/api/v1/knowledge-bases/queries",
			{
				name,
				agent_codes,
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 获取知识库详情
	 */
	getKnowledgeDetail(code: string) {
		return fetch.get<Knowledge.Detail>(`/api/v1/knowledge-bases/${code}`)
	},

	/**
	 * 获取知识库详情 (Crew专用)
	 */
	getCrewKnowledgeDetail(code: string) {
		return fetch.get<CrewKnowledge.Detail>(`/api/v1/knowledge-bases/${code}`)
	},

	/**
	 * 删除知识库
	 */
	deleteKnowledge(code: string) {
		return fetch.delete<Knowledge.Detail>(`/api/v1/knowledge-bases/${code}`)
	},

	/**
	 * 获取知识库的文档列表(旧版)
	 */
	getKnowledgeDocumentList({
		code,
		name,
		page,
		pageSize,
	}: {
		code: string
		name?: string
		page?: number
		pageSize?: number
	}) {
		return fetch.post<WithPage<Knowledge.EmbedDocumentDetail[]>>(
			`/api/v1/knowledge-bases/${code}/documents/queries`,
			{
				name,
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 获取知识库的文档列表(新版 - Crew专用)
	 */
	getCrewKnowledgeDocumentList({
		code,
		name,
		page = 1,
		pageSize = 20,
	}: {
		code: string
		name?: string
		page?: number
		pageSize?: number
	}) {
		return fetch.post<WithPage<CrewKnowledge.EmbedDocumentDetail[]>>(
			`/api/v1/knowledge-bases/${code}/documents/queries`,
			{
				name,
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 添加知识库的文档
	 */
	addKnowledgeDocument(params: Knowledge.AddKnowledgeDocumentParams) {
		return fetch.post<Knowledge.Detail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents`,
			params,
		)
	},

	/**
	 * 添加知识库的文档 (Crew专用)
	 */
	addCrewKnowledgeDocument(params: CrewKnowledge.AddKnowledgeDocumentParams) {
		return fetch.post<CrewKnowledge.EmbedDocumentDetail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents`,
			params,
		)
	},

	/**
	 * 获取知识库的文档原文链接
	 */
	getDocumentOriginalFileLink(params: { knowledge_code: string; document_code: string }) {
		return fetch.get<{ url: string }>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}/original-file-link`,
		)
	},

	/**
	 * 获取知识库源文件打开链接
	 */
	getKnowledgeSourceFileLink(params: Knowledge.GetKnowledgeSourceFileLinkParams) {
		return fetch.post<{ data: Knowledge.KnowledgeSourceFileLink }>(
			`/go/api/v1/knowledge-bases/${params.knowledgeBaseCode}/documents/${params.documentCode}/source-file-link`,
			{
				file_key: params.fileKey,
			},
		)
	},

	/**
	 * 获取知识库的文档详情
	 */
	getKnowledgeDocumentDetail(params: { knowledge_code: string; document_code: string }) {
		return fetch.get<Knowledge.EmbedDocumentDetail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
		)
	},

	/**
	 * 获取知识库的文档详情 (Crew专用)
	 */
	getCrewKnowledgeDocumentDetail(params: { knowledge_code: string; document_code: string }) {
		return fetch.get<CrewKnowledge.EmbedDocumentDetail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
		)
	},

	/**
	 * 更新知识库的文档
	 */
	updateKnowledgeDocument(params: Knowledge.UpdateKnowledgeDocumentParams) {
		return fetch.put<Knowledge.EmbedDocumentDetail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
			{
				name: params.name,
				enabled: params.enabled,
				fragment_config: params.fragment_config,
			},
		)
	},

	/**
	 * 更新知识库的文档 (Crew专用)
	 * 使用 POST 方法，后端会自动更新文档并执行重新向量化
	 */
	updateCrewKnowledgeDocument(params: CrewKnowledge.UpdateKnowledgeDocumentParams) {
		return fetch.put<CrewKnowledge.EmbedDocumentDetail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
			{
				name: params.name,
				enabled: params.enabled,
				fragment_config: params.fragment_config,
				strategy_config: params.strategy_config,
				document_file: params.document_file,
			},
		)
	},

	/**
	 * 删除知识库的文档
	 */
	deleteKnowledgeDocument(params: Knowledge.DeleteKnowledgeDocumentParams) {
		return fetch.delete<Knowledge.Detail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
		)
	},

	/**
	 * 删除知识库的文档 (Crew专用)
	 */
	deleteCrewKnowledgeDocument(params: CrewKnowledge.DeleteKnowledgeDocumentParams) {
		return fetch.delete<CrewKnowledge.Detail>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/documents/${params.document_code}`,
		)
	},

	/**
	 * 分段预览
	 */
	segmentPreview(params: Knowledge.SegmentPreviewParams) {
		return fetch.post<WithPage<Knowledge.FragmentItem[]>>(
			"/api/v1/knowledge-bases/fragments/preview",
			params,
		)
	},

	/**
	 * Crew 专用分段预览
	 */
	crewSegmentPreview(params: Knowledge.CrewSegmentPreviewParams) {
		return fetch.post<Knowledge.FragmentListWithNodes>(
			"/api/v1/knowledge-bases/fragments/preview",
			params,
		)
	},

	/**
	 * 召回测试
	 */
	recallTest(params: { knowledge_code: string; query: string }) {
		return fetch.post<WithPage<Knowledge.FragmentItem[]>>(
			`/api/v1/knowledge-bases/${params.knowledge_code}/fragments/similarity`,
			{ query: params.query },
		)
	},

	/**
	 * 获取文档的片段列表
	 */
	getFragmentList(params: Knowledge.GetFragmentListParams) {
		return fetch.post<Knowledge.FragmentListWithNodes>(
			`/api/v1/knowledge-bases/${params.knowledgeBaseCode}/documents/${params.documentCode}/fragments/queries`,
			{
				page: params.page,
				page_size: params.pageSize,
			},
		)
	},

	/**
	 * 文档重新向量化
	 */
	revectorizeDocument(params: {
		knowledgeBaseCode: string
		documentCode: string
		sync?: boolean
	}) {
		return fetch.post(
			`/api/v1/knowledge-bases/${params.knowledgeBaseCode}/documents/${params.documentCode}/re-vectorized`,
			{
				sync: params.sync,
			},
		)
	},

	/**
	 * 获取嵌入模型列表
	 */
	getEmbeddingModelList() {
		return fetch.get<Knowledge.ServiceProvider[]>(
			"/api/v1/knowledge-bases/providers/embedding/list",
		)
	},

	/**
	 * 重建知识库
	 * TODO: 确认应使用 id 还是 code。旧模板提供 id 却引用 code，暂保留 /knowledge-bases/undefined。
	 */
	rebuildKnowledge(_id: string) {
		return fetch.post<Knowledge.Detail>("/api/v1/knowledge-bases/undefined")
	},

	/**
	 * 获取可用的天书知识库列表
	 */
	getUseableTeamshareDatabaseList() {
		return fetch.get<WithPage<Knowledge.KnowledgeDatabaseItem[]>>(
			"/api/v1/teamshare/knowledge/manageable",
		)
	},

	/**
	 * 获取有权限的知识库的进度
	 */
	getTeamshareKnowledgeProgress(params: Knowledge.GetTeamshareKnowledgeProgressParams) {
		return fetch.post<WithPage<Knowledge.KnowledgeDatabaseProgress[]>>(
			"/api/v1/teamshare/knowledge/manageable-progress",
			params,
		)
	},

	/**
	 * 发起知识库的向量创建
	 */
	createTeamshareKnowledgeVector(params: Knowledge.CreateTeamshareKnowledgeVectorParams) {
		return fetch.post<null>("/api/v1/teamshare/knowledge/start-vector", params)
	},

	/**
	 * 根据类型获取所有激活模型
	 */
	getActiveModelByCategory(params: Knowledge.GetActiveModelByCategoryParams) {
		return fetch.get<Knowledge.ServiceProvider[]>(
			"/api/v1/admin/service-providers/by-category",
			{ params: { ...params } },
		)
	},

	/**
	 * 获取官方重排模型列表
	 */
	getRerankModels() {
		return fetch.get<Knowledge.ServiceProvider[]>(
			"/api/v1/knowledge-base/providers/rerank/list",
		)
	},

	/**
	 * 获取临时上传凭证
	 */
	getTemporaryCredential(params: CrewKnowledge.GetTemporaryCredentialParams) {
		return fetch.post<CrewKnowledge.GetTemporaryCredentialResponse>(
			"/api/v1/file/temporary-credential",
			params,
		)
	},

	/**
	 * 获取来源绑定节点列表
	 * 用于项目文件和企业知识库类型的数据源选择
	 */
	getSourceBindingNodes(params: GetSourceBindingNodesParams) {
		return fetch.get<SourceBindingNodesResponse>(
			"/api/v1/knowledge-bases/source-bindings/nodes",
			{ params: { ...params } },
		)
	},
})

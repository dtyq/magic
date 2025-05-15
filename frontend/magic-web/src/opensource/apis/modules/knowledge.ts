import { genRequestUrl } from "@/utils/http"
import type { VectorKnowledge, WithPage } from "@/types/flow"
import type { Knowledge } from "@/types/knowledge"
import type { HttpClient } from "../core/HttpClient"
import { RequestUrl } from "../constant"
import { knowledgeType } from "@/opensource/pages/vectorKnowledge/constant"

export const generateKnowledgeApi = (fetch: HttpClient) => ({
	/**
	 * 创建知识库
	 */
	createKnowledge(params: Knowledge.CreateKnowledgeParams) {
		return fetch.post<Knowledge.CreateKnowledgeResult>(
			genRequestUrl(RequestUrl.createKnowledge),
			params,
		)
	},

	/**
	 * 更新知识库
	 */
	updateKnowledge(params: Knowledge.UpdateKnowledgeParams) {
		return fetch.put<Knowledge.Detail>(
			genRequestUrl(RequestUrl.updateKnowledge, { code: params.code }),
			params,
		)
	},

	/**
	 * 获取知识库列表
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
			genRequestUrl(RequestUrl.getKnowledgeList),
			{
				name,
				page,
				page_size: pageSize,
				search_type: searchType,
				type,
			},
		)
	},

	/**
	 * 获取知识库详情
	 */
	getKnowledgeDetail(code: string) {
		return fetch.get<Knowledge.Detail>(genRequestUrl(RequestUrl.getKnowLedgeDetail, { code }))
	},

	/**
	 * 删除知识库
	 */
	deleteKnowledge(code: string) {
		return fetch.delete<Knowledge.Detail>(genRequestUrl(RequestUrl.deleteKnowledge, { code }))
	},

	/**
	 * 获取知识库的文档列表
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
			genRequestUrl(RequestUrl.getKnowledgeDocumentList, { code }),
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
			genRequestUrl(RequestUrl.addKnowledgeDocument, {
				code: params.knowledge_code,
			}),
			params,
		)
	},

	/**
	 * 获取知识库的文档详情
	 */
	getKnowledgeDocumentDetail(params: { knowledge_code: string; document_code: string }) {
		return fetch.get<Knowledge.EmbedDocumentDetail>(
			genRequestUrl(RequestUrl.getKnowledgeDocumentDetail, {
				knowledge_code: params.knowledge_code,
				document_code: params.document_code,
			}),
		)
	},

	/**
	 * 更新知识库的文档
	 */
	updateKnowledgeDocument(params: Knowledge.UpdateKnowledgeDocumentParams) {
		return fetch.put<Knowledge.EmbedDocumentDetail>(
			genRequestUrl(RequestUrl.updateKnowledgeDocument, {
				knowledge_code: params.knowledge_code,
				document_code: params.document_code,
			}),
			{
				name: params.name,
				enabled: params.enabled,
				fragment_config: params.fragment_config,
			},
		)
	},

	/**
	 * 删除知识库的文档
	 */
	deleteKnowledgeDocument(params: Knowledge.DeleteKnowledgeDocumentParams) {
		return fetch.delete<Knowledge.Detail>(
			genRequestUrl(RequestUrl.deleteKnowledgeDocument, {
				knowledge_code: params.knowledge_code,
				document_code: params.document_code,
			}),
		)
	},

	/**
	 * 分段预览
	 */
	segmentPreview(params: Knowledge.SegmentPreviewParams) {
		return fetch.post<WithPage<Knowledge.FragmentItem[]>>(RequestUrl.segmentPreview, params)
	},

	/**
	 * 召回测试
	 */
	recallTest(params: { knowledge_code: string; query: string }) {
		return fetch.post<WithPage<Knowledge.FragmentItem[]>>(
			genRequestUrl(RequestUrl.recallTest, {
				knowledge_code: params.knowledge_code,
			}),
			{ query: params.query },
		)
	},

	/**
	 * 获取文档的片段列表
	 */
	getFragmentList(params: Knowledge.GetFragmentListParams) {
		return fetch.post<WithPage<Knowledge.FragmentItem[]>>(
			genRequestUrl(RequestUrl.getFragmentList, {
				knowledge_base_code: params.knowledgeBaseCode,
				document_code: params.documentCode,
			}),
			{
				page: params.page,
				page_size: params.pageSize,
			},
		)
	},

	/**
	 * 文档重新向量化
	 */
	revectorizeDocument(params: { knowledgeBaseCode: string; documentCode: string }) {
		return fetch.post(
			genRequestUrl(RequestUrl.revectorizeDocument, {
				knowledge_base_code: params.knowledgeBaseCode,
				document_code: params.documentCode,
			}),
		)
	},

	/**
	 * 获取嵌入模型列表
	 */
	getEmbeddingModelList() {
		return fetch.get<Knowledge.ServiceProvider[]>(RequestUrl.getEmbeddingModelList)
	},

	/**
	 * 重建知识库
	 */
	rebuildKnowledge(id: string) {
		return fetch.post<Knowledge.Detail>(genRequestUrl(RequestUrl.deleteKnowledge, { id }))
	},

	/**
	 * 获取可用的天书知识库列表
	 */
	getUseableTeamshareDatabaseList() {
		return fetch.get<WithPage<Knowledge.KnowledgeDatabaseItem[]>>(
			RequestUrl.getUseableTeamshareDatabaseList,
		)
	},

	/**
	 * 获取有权限的知识库的进度
	 */
	getTeamshareKnowledgeProgress(params: Knowledge.GetTeamshareKnowledgeProgressParams) {
		return fetch.post<WithPage<Knowledge.KnowledgeDatabaseProgress[]>>(
			RequestUrl.getTeamshareKnowledgeProgress,
			params,
		)
	},

	/**
	 * 发起知识库的向量创建
	 */
	createTeamshareKnowledgeVector(params: Knowledge.CreateTeamshareKnowledgeVectorParams) {
		return fetch.post<null>(RequestUrl.createTeamshareKnowledgeVector, params)
	},

	/**
	 * 根据类型获取所有激活模型
	 */
	getActiveModelByCategory(params: Knowledge.GetActiveModelByCategoryParams) {
		return fetch.get<Knowledge.ServiceProvider[]>(
			genRequestUrl(RequestUrl.getActiveModelByCategory, {}, params),
		)
	},

	/**
	 * 获取官方重排模型列表
	 */
	getRerankModels() {
		return fetch.get<Knowledge.ServiceProvider[]>(RequestUrl.getRerankModels)
	},
})

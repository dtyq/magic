import { makeAutoObservable, runInAction } from "mobx"
import { KnowledgeApi } from "@/apis"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import magicToast from "@/components/base/MagicToaster/utils"
import i18n from "i18next"
import type { CrewKnowledge } from "@/types/crew-knowledge"
import type { ContentNode } from "../components/StepDetailPanel/KnowledgeDetailView/types/content-node"
import type { CrewCodeController } from "./shared"

export class CrewKnowledgeStore {
	knowledgeList: CrewKnowledge.KnowledgeItem[] = []
	loading = false
	initialLoaded = false
	page = 1
	pageSize = 20
	total = 0
	hasMore = false

	// 知识库详情相关状态
	selectedKnowledgeCode: string | null = null
	documentList: CrewKnowledge.EmbedDocumentDetail[] = []
	selectedDocumentCode: string | null = null
	documentDetail: CrewKnowledge.EmbedDocumentDetail | null = null
	showOriginalPreview = false
	documentLoading = false

	// 文档列表分页状态
	documentPage = 1
	documentPageSize = 100
	documentTotal = 0
	documentHasMore = false
	// 追踪已加载的最大页码(用于轮询时保持范围)
	private maxLoadedDocumentPage = 1

	// 文档内容数据
	documentNodes: ContentNode[] = []
	originalContent: string = ""
	documentContentLoading = false

	// 请求序列号，用于避免竞态条件
	private documentDetailRequestId = 0
	private documentContentRequestId = 0

	/**
	 * 文档内容缓存：key 为 documentCode，value 为文档内容
	 * 缓存策略：
	 * - 访问过的文档会永久缓存（直到页面卸载）
	 * - 切换知识库、删除文档时不清理缓存（documentCode 全局唯一）
	 * - 仅在 reset() 时统一清理（组件卸载时）
	 */
	private documentContentCache = new Map<
		string,
		{
			documentNodes: ContentNode[]
			originalContent: string
		}
	>()

	private documentListRequestId = 0

	private readonly _getCrewCode: CrewCodeController["getCrewCode"]

	constructor({ getCrewCode }: Pick<CrewCodeController, "getCrewCode">) {
		this._getCrewCode = getCrewCode
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get isEmpty(): boolean {
		// 如果还在初始加载中，不显示缺省页
		if (!this.initialLoaded) return false
		// 只有在初始加载完成、列表为空时才显示缺省页
		return !this.loading && this.knowledgeList.length === 0
	}

	async fetchKnowledgeList(reset = false, silent = false): Promise<void> {
		// 如果是静默刷新，不清空列表，不显示 loading
		if (reset && !silent) {
			this.page = 1
			this.knowledgeList = []
		}

		if (reset && silent) {
			this.page = 1
		}

		// 只在非静默模式下设置 loading
		if (!silent) {
			this.loading = true
		}

		try {
			const crewCode = this._getCrewCode()
			const response = await KnowledgeApi.getCrewKnowledgeList({
				agent_codes: crewCode ? [crewCode] : undefined,
				page: this.page,
				pageSize: this.pageSize,
			})

			runInAction(() => {
				if (reset) {
					this.knowledgeList = response.list
				} else {
					this.knowledgeList.push(...response.list)
				}
				this.total = response.total
				this.hasMore = response.list.length === this.pageSize
				this.loading = false
				this.initialLoaded = true
			})
		} catch (error) {
			runInAction(() => {
				this.loading = false
				this.initialLoaded = true
			})
		}
	}

	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading) return
		this.page += 1
		await this.fetchKnowledgeList(false)
	}

	// 知识库详情相关方法
	setSelectedKnowledge(code: string | null) {
		this.selectedKnowledgeCode = code
		if (code) {
			// 重置文档分页状态
			this.documentPage = 1
			this.maxLoadedDocumentPage = 1
			this.documentList = []
			this.documentHasMore = false
			void this.fetchDocumentList(code)
		} else {
			this.documentList = []
			this.selectedDocumentCode = null
			this.documentDetail = null
			this.documentPage = 1
			this.maxLoadedDocumentPage = 1
			this.documentHasMore = false
		}
	}

	async fetchDocumentList(
		knowledgeCode: string,
		name?: string,
		reset = true,
		silent = false,
		skipAutoSelect = false,
		preservePageRange = false,
	): Promise<void> {
		const requestId = ++this.documentListRequestId

		// 轮询模式：批量拉取已加载的所有页面
		if (preservePageRange && this.maxLoadedDocumentPage > 1) {
			// 拉取所有已加载的页面
			const pagesToFetch = this.maxLoadedDocumentPage

			try {
				// 批量拉取所有已加载页面
				const allPages = await Promise.all(
					Array.from({ length: pagesToFetch }, (_, i) =>
						KnowledgeApi.getCrewKnowledgeDocumentList({
							code: knowledgeCode,
							name,
							page: i + 1,
							pageSize: this.documentPageSize,
						}),
					),
				)

				runInAction(() => {
					if (requestId !== this.documentListRequestId) return

					// 合并所有页面数据
					const allDocs = allPages.flatMap((res) => res.list)
					const total = allPages[0]?.total || 0

					// 智能更新：保持引用，只更新状态字段
					this.documentList = this.smartMergeDocuments(allDocs)
					this.documentTotal = total
					this.documentHasMore = allDocs.length < total

					// 不重置 loading（轮询模式下应该是 silent=true）
					if (!silent) {
						this.documentLoading = false
					}
				})
				return // 批量轮询成功，直接返回
			} catch (error) {
				console.error("批量轮询文档列表失败:", error)
				// 出错时保持现有数据，不降级到单页模式
				runInAction(() => {
					if (!silent) {
						this.documentLoading = false
					}
				})
				return // 失败也要返回，不继续执行单页模式
			}
		}

		// 如果是重置（搜索或初始化），重置分页状态
		if (reset && !preservePageRange) {
			this.documentPage = 1
			this.maxLoadedDocumentPage = 1
			// 仅在非静默模式下清空列表（避免闪烁）
			if (!silent) {
				this.documentList = []
			}
		}

		// 仅在非静默模式下显示 loading
		if (!silent) {
			this.documentLoading = true
		}
		try {
			const response = await KnowledgeApi.getCrewKnowledgeDocumentList({
				code: knowledgeCode,
				name,
				page: this.documentPage,
				pageSize: this.documentPageSize,
			})

			runInAction(() => {
				if (requestId !== this.documentListRequestId) return

				const isSearchMode = Boolean(name?.trim())

				// 追加或替换数据
				if (silent && reset) {
					// 静默模式：合并本页数据，sync_status 等字段变化时也必须替换列表，否则 UI 可能不刷新
					const existingMap = new Map(this.documentList.map((doc) => [doc.code, doc]))
					const newList: typeof response.list = []

					response.list.forEach((newDoc) => {
						const existing = existingMap.get(newDoc.code)
						if (existing) {
							newList.push({
								...existing,
								sync_status: newDoc.sync_status,
								name: newDoc.name,
								description: newDoc.description,
								updated_at: newDoc.updated_at,
								enabled: newDoc.enabled,
							})
						} else {
							newList.push(newDoc)
						}
					})

					this.documentList = newList
				} else if (reset) {
					// 非静默模式：直接替换
					this.documentList = response.list
				} else if (preservePageRange) {
					// 轮询模式（单页情况）：合并更新而不是追加
					// 用于重新向量化后的轮询刷新，避免重复追加数据
					const existingMap = new Map(this.documentList.map((doc) => [doc.code, doc]))

					response.list.forEach((newDoc) => {
						const existing = existingMap.get(newDoc.code)
						if (existing) {
							// 更新现有文档的状态字段
							existing.sync_status = newDoc.sync_status
							existing.name = newDoc.name
							existing.description = newDoc.description
							existing.updated_at = newDoc.updated_at
							existing.enabled = newDoc.enabled
						} else {
							// 新增的文档，追加到列表
							this.documentList.push(newDoc)
						}
					})
				} else {
					// 加载更多时追加
					this.documentList.push(...response.list)
				}

				this.documentTotal = response.total
				this.documentHasMore = response.list.length === this.documentPageSize

				const codeSet = new Set(this.documentList.map((d) => d.code))
				const selectionValid =
					this.selectedDocumentCode !== null && codeSet.has(this.selectedDocumentCode)

				if (this.documentList.length === 0) {
					// 搜索结果为空时，保留当前选中的文档详情，只更新左侧筛选列表
					if (!isSearchMode) {
						this.selectedDocumentCode = null
						this.documentDetail = null
						this.documentNodes = []
						this.originalContent = ""
					}
				} else if (!selectionValid && reset && !skipAutoSelect) {
					// 只有在重置时才自动选中第一个文档（避免滚动加载时改变选中项）
					const firstDocCode = this.documentList[0].code
					this.selectedDocumentCode = firstDocCode
					void this.fetchDocumentDetail(knowledgeCode, firstDocCode)

					// 检查缓存
					const cached = this.documentContentCache.get(firstDocCode)
					if (cached) {
						this.documentNodes = cached.documentNodes
						this.originalContent = cached.originalContent
						void this.fetchDocumentContentData(knowledgeCode, firstDocCode, false)
					} else {
						void this.fetchDocumentContentData(knowledgeCode, firstDocCode, true)
					}
				} else if (
					selectionValid &&
					this.selectedDocumentCode &&
					reset &&
					!skipAutoSelect
				) {
					// 只有在重置时才重新获取详情
					void this.fetchDocumentDetail(knowledgeCode, this.selectedDocumentCode)

					// 检查缓存
					const cached = this.documentContentCache.get(this.selectedDocumentCode)
					if (cached) {
						this.documentNodes = cached.documentNodes
						this.originalContent = cached.originalContent
						void this.fetchDocumentContentData(
							knowledgeCode,
							this.selectedDocumentCode,
							false,
						)
					} else {
						void this.fetchDocumentContentData(
							knowledgeCode,
							this.selectedDocumentCode,
							true,
						)
					}
				}

				// 仅在非静默模式下重置 loading
				if (!silent) {
					this.documentLoading = false
				}
			})
		} catch (error) {
			runInAction(() => {
				if (requestId !== this.documentListRequestId) return
				// 仅在非静默模式下重置 loading
				if (!silent) {
					this.documentLoading = false
				}
			})
		}
	}

	/**
	 * 智能合并文档列表，保持已存在项的引用，只更新状态字段
	 * @param newDocs 新拉取的文档列表
	 * @returns 合并后的文档列表
	 */
	private smartMergeDocuments(
		newDocs: CrewKnowledge.EmbedDocumentDetail[],
	): CrewKnowledge.EmbedDocumentDetail[] {
		const existingMap = new Map(this.documentList.map((doc) => [doc.code, doc]))
		const resultList: CrewKnowledge.EmbedDocumentDetail[] = []

		newDocs.forEach((newDoc) => {
			const existing = existingMap.get(newDoc.code)
			if (existing) {
				// 已存在：创建新对象，更新关键字段
				resultList.push({
					...existing,
					sync_status: newDoc.sync_status,
					name: newDoc.name,
					description: newDoc.description,
					updated_at: newDoc.updated_at,
					enabled: newDoc.enabled,
				})
			} else {
				// 新增：直接添加
				resultList.push(newDoc)
			}
		})

		return resultList
	}

	/**
	 * 加载更多文档
	 */
	async loadMoreDocuments(knowledgeCode: string, name?: string): Promise<void> {
		if (!this.documentHasMore || this.documentLoading) return
		this.documentPage += 1
		this.maxLoadedDocumentPage = Math.max(this.maxLoadedDocumentPage, this.documentPage)
		await this.fetchDocumentList(knowledgeCode, name, false)
	}

	/**
	 * 重置文档分页状态（用于搜索等场景）
	 */
	resetDocumentPagination() {
		this.documentPage = 1
		this.maxLoadedDocumentPage = 1
	}

	selectDocument(documentCode: string) {
		this.selectedDocumentCode = documentCode
		if (this.selectedKnowledgeCode) {
			// 先从缓存加载（如果有）
			const cached = this.documentContentCache.get(documentCode)
			if (cached) {
				// 有缓存，立即显示缓存内容
				this.documentNodes = cached.documentNodes
				this.originalContent = cached.originalContent
				// 后台静默刷新（不显示 loading）
				void this.fetchDocumentDetail(this.selectedKnowledgeCode, documentCode)
				void this.fetchDocumentContentData(this.selectedKnowledgeCode, documentCode, false)
			} else {
				// 无缓存，显示 loading 并加载
				void this.fetchDocumentDetail(this.selectedKnowledgeCode, documentCode)
				void this.fetchDocumentContentData(this.selectedKnowledgeCode, documentCode, true)
			}
		}
	}

	async fetchDocumentDetail(knowledgeCode: string, documentCode: string): Promise<void> {
		// 生成新的请求序列号
		const requestId = ++this.documentDetailRequestId

		try {
			const response = await KnowledgeApi.getCrewKnowledgeDocumentDetail({
				knowledge_code: knowledgeCode,
				document_code: documentCode,
			})

			// 只处理最新的请求响应，忽略过期的请求
			if (requestId !== this.documentDetailRequestId) {
				console.log(
					`忽略过期的文档详情响应: requestId=${requestId}, latest=${this.documentDetailRequestId}`,
				)
				return
			}

			runInAction(() => {
				this.documentDetail = response
			})
		} catch (error) {
			// 只处理最新的请求错误
			if (requestId !== this.documentDetailRequestId) {
				console.log(
					`忽略过期的文档详情错误: requestId=${requestId}, latest=${this.documentDetailRequestId}`,
				)
				return
			}

			console.error("Failed to fetch document detail:", error)

			// 提示用户文档不存在
			magicToast.warning(
				i18n.t("crew/create:knowledgeDetail.documentNotFoundRefreshing") ||
					"文档已不存在，即将刷新列表",
			)

			runInAction(() => {
				// 找到被删除文档在列表中的索引
				const deletedIndex = this.documentList.findIndex((doc) => doc.code === documentCode)

				// 从列表中移除不存在的文档
				this.documentList = this.documentList.filter((doc) => doc.code !== documentCode)
				this.documentTotal = Math.max(0, this.documentTotal - 1)

				// 清空当前选中的文档状态
				this.selectedDocumentCode = null
				this.documentDetail = null
				this.documentNodes = []
				this.originalContent = ""

				// 从缓存中移除
				this.documentContentCache.delete(documentCode)

				// 选中上一个文档
				if (this.documentList.length > 0) {
					// 如果删除的不是第一个，选中上一个（索引-1）
					// 如果删除的是第一个，选中新的第一个（索引0）
					const prevIndex = deletedIndex > 0 ? deletedIndex - 1 : 0
					const prevDocCode = this.documentList[prevIndex]?.code

					if (prevDocCode) {
						this.selectedDocumentCode = prevDocCode
						void this.fetchDocumentDetail(knowledgeCode, prevDocCode)

						// 检查缓存
						const cached = this.documentContentCache.get(prevDocCode)
						if (cached) {
							this.documentNodes = cached.documentNodes
							this.originalContent = cached.originalContent
							void this.fetchDocumentContentData(knowledgeCode, prevDocCode, false)
						} else {
							void this.fetchDocumentContentData(knowledgeCode, prevDocCode, true)
						}
					}
				}
			})
		}
	}

	/**
	 * 获取文档内容数据（文档节点和原文）
	 * @param knowledgeCode 知识库code
	 * @param documentCode 文档code
	 * @param showLoading 是否显示loading状态，默认true。当有缓存时可传false实现后台静默刷新
	 */
	async fetchDocumentContentData(
		knowledgeCode: string,
		documentCode: string,
		showLoading = true,
	): Promise<void> {
		// 生成新的请求序列号
		const requestId = ++this.documentContentRequestId

		if (showLoading) {
			this.documentContentLoading = true
		}

		try {
			// 并行请求文档节点和原文链接
			const [
				fragmentsResponse,
				//originalLinkResponse
			] = await Promise.all([
				KnowledgeApi.getFragmentList({
					knowledgeBaseCode: knowledgeCode,
					documentCode: documentCode,
					page: 1,
					pageSize: 100,
				}),
				// KnowledgeApi.getDocumentOriginalFileLink({
				// 	knowledge_code: knowledgeCode,
				// 	document_code: documentCode,
				// }),
			])

			// 只处理最新的请求响应，忽略过期的请求
			if (requestId !== this.documentContentRequestId) {
				console.log(
					`忽略过期的文档内容响应: requestId=${requestId}, latest=${this.documentContentRequestId}`,
				)
				return
			}

			// 下载原文内容
			const originalContent = ""
			// if (originalLinkResponse.url) {
			// 	const content = await downloadFileContent(originalLinkResponse.url, {
			// 		responseType: "text",
			// 	})
			// 	originalContent = content as string
			// }

			const documentNodes = fragmentsResponse.document_nodes || []

			runInAction(() => {
				this.documentNodes = documentNodes
				this.originalContent = originalContent
				this.documentContentLoading = false

				// 更新缓存
				this.documentContentCache.set(documentCode, {
					documentNodes,
					originalContent,
				})
			})
		} catch (error) {
			// 只处理最新的请求错误
			if (requestId !== this.documentContentRequestId) {
				console.log(
					`忽略过期的文档内容错误: requestId=${requestId}, latest=${this.documentContentRequestId}`,
				)
				return
			}

			console.error("Failed to fetch document content data:", error)
			runInAction(() => {
				// 如果没有缓存，清空显示
				if (!this.documentContentCache.has(documentCode)) {
					this.documentNodes = []
					this.originalContent = ""
				}
				this.documentContentLoading = false
			})
		}
	}

	async deleteKnowledge(code: string): Promise<boolean> {
		try {
			await KnowledgeApi.deleteKnowledge(code)
			// 删除成功后刷新列表
			await this.fetchKnowledgeList(true, true)
			return true
		} catch (error) {
			console.error("Failed to delete knowledge:", error)
			return false
		}
	}

	async deleteDocument(knowledgeCode: string, documentCode: string): Promise<boolean> {
		try {
			await KnowledgeApi.deleteCrewKnowledgeDocument({
				knowledge_code: knowledgeCode,
				document_code: documentCode,
			})

			// 删除成功后重置并刷新文档列表
			this.documentPage = 1
			this.documentList = []
			await this.fetchDocumentList(knowledgeCode)
			return true
		} catch (error) {
			console.error("Failed to delete document:", error)
			return false
		}
	}

	toggleOriginalPreview() {
		this.showOriginalPreview = !this.showOriginalPreview
	}

	/**
	 * 重置所有状态（组件卸载时调用）
	 * 这是清理文档内容缓存的唯一时机
	 */
	reset() {
		this.knowledgeList = []
		this.loading = false
		this.initialLoaded = false
		this.page = 1
		this.total = 0
		this.hasMore = false
		// 重置详情相关状态
		this.selectedKnowledgeCode = null
		this.documentList = []
		this.selectedDocumentCode = null
		this.documentDetail = null
		this.showOriginalPreview = false
		this.documentLoading = false
		// 重置文档列表分页状态
		this.documentPage = 1
		this.documentTotal = 0
		this.documentHasMore = false
		// 重置文档内容数据
		this.documentNodes = []
		this.originalContent = ""
		this.documentContentLoading = false
		// 清空缓存（仅在组件卸载时清理，日常使用中缓存会一直保留）
		this.documentContentCache.clear()
	}
}

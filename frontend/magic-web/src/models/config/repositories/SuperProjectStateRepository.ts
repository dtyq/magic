import { GlobalBaseRepository } from "@/models/repository/GlobalBaseRepository"
import { Storage } from "../../repository/Cache"
import { logger } from "../../repository/logger"

// 文件Tab信息接口
interface CachedTabItem {
	id: string
	title: string
	fileData: {
		file_id: string
		file_name?: string
		filename?: string
		display_filename?: string
		file_extension?: string
		relative_file_path?: string
		metadata?: any
		updated_at?: string
	}
	active: boolean
	filePath?: string
	metadata?: any
}

// 文件状态接口
interface FileState {
	tabs: CachedTabItem[]
	activeTabId?: string
	detailState?: {
		autoDetail?: any
		userDetail?: any
	}
	pptActiveIndexMap?: Record<string, number>
	playbackTabExists?: boolean // 记录playback tab是否存在
	playbackTabActive?: boolean // 记录playback tab是否激活
}

// 树形展开状态接口
interface TreeState {
	expandedKeys: string[]
}

// 搜索状态接口
interface SearchState {
	searchValue?: string
	filters?: {
		documents?: boolean
		multimedia?: boolean
		code?: boolean
	}
}

// UI状态接口
interface UIState {
	sidebarCollapsed?: boolean
	viewMode?: string
	panelSizes?: number[]
}

// 项目状态缓存接口
interface ProjectState {
	id?: string
	organization_code: string
	project_id: string
	fileState?: FileState
	treeState?: TreeState
	searchState?: SearchState
	uiState?: UIState
	createdAt?: number
	updatedAt?: number
}

export class ProjectStateRepository extends GlobalBaseRepository<ProjectState> {
	static readonly tableName = "super-project-state"

	static readonly version = 1

	constructor() {
		super(ProjectStateRepository.tableName)
	}

	/**
	 * 生成缓存键
	 */
	private getCacheKey(organizationCode: string, projectId: string): string {
		return `${organizationCode}_${projectId}`
	}

	/**
	 * 净化数据以确保可被 IndexedDB 结构化克隆（去除 MobX Proxy、函数等不可序列化值）
	 */
	private sanitizeForStorage<T>(data: T): T {
		try {
			return JSON.parse(JSON.stringify(data))
		} catch (e) {
			logger.warn("sanitizeForStorage: top-level clone failed, retrying field-by-field", e)
			if (typeof data !== "object" || data === null) return data
			const result: any = Array.isArray(data) ? [] : {}
			for (const key of Object.keys(data as object)) {
				try {
					result[key] = JSON.parse(JSON.stringify((data as any)[key]))
				} catch {
					logger.warn(`sanitizeForStorage: skipping non-serializable field "${key}"`)
				}
			}
			return result as T
		}
	}

	/**
	 * 验证项目状态数据的有效性
	 */
	private validateProjectState(state: any): state is ProjectState {
		try {
			// 基本结构验证
			if (!state || typeof state !== "object") {
				return false
			}

			// 必要字段验证
			if (!state.organization_code || !state.project_id) {
				return false
			}

			// 文件状态验证
			if (state.fileState) {
				if (!Array.isArray(state.fileState.tabs)) {
					return false
				}
			}

			// 树状态验证
			if (state.treeState) {
				if (!Array.isArray(state.treeState.expandedKeys)) {
					return false
				}
			}

			return true
		} catch (error) {
			logger.error("validateProjectState error", error)
			return false
		}
	}

	/**
	 * 获取项目状态缓存
	 */
	public async getProjectState(
		organizationCode: string,
		projectId: string,
	): Promise<ProjectState | undefined> {
		// 参数验证
		if (!organizationCode || !projectId) {
			logger.warn("getProjectState: Invalid parameters", { organizationCode, projectId })
			return undefined
		}

		try {
			const cacheKey = this.getCacheKey(organizationCode, projectId)
			const state = await this.get(cacheKey)

			// 数据验证
			if (state && this.validateProjectState(state)) {
				return state
			} else if (state) {
				logger.warn("getProjectState: Invalid cached data detected, removing", cacheKey)
				// 删除损坏的数据
				this.delete(cacheKey).catch((err) =>
					logger.error("Failed to delete corrupted cache", err),
				)
				return undefined
			}

			return state
		} catch (error: any) {
			// 检查是否是表不存在的错误（数据库版本未升级）
			const isTableNotExistError =
				error?.message?.includes("Table does not exist") ||
				error?.inner?.message?.includes("Table does not exist") ||
				error?.name === "NotFoundError"

			if (isTableNotExistError) {
				logger.error(
					"getProjectState: Table not found, database may need upgrade",
					ProjectStateRepository.tableName,
				)
			} else {
				logger.error("getProjectStateError", ProjectStateRepository.tableName, error)
			}

			// 尝试从内存缓存获取
			try {
				const cacheKey = this.getCacheKey(organizationCode, projectId)
				const fallbackState = Storage.get(`${ProjectStateRepository.tableName}:${cacheKey}`)

				if (fallbackState && this.validateProjectState(fallbackState)) {
					return fallbackState
				}
			} catch (fallbackError) {
				logger.error("getProjectState: Fallback also failed", fallbackError)
			}

			return undefined
		}
	}

	/**
	 * 保存项目状态缓存
	 */
	public async saveProjectState(
		projectState: Omit<ProjectState, "id" | "createdAt" | "updatedAt">,
	): Promise<void> {
		// 参数验证
		if (!projectState.organization_code || !projectState.project_id) {
			logger.warn("saveProjectState: Invalid parameters", projectState)
			return
		}

		try {
			const cacheKey = this.getCacheKey(
				projectState.organization_code,
				projectState.project_id,
			)
			let existingState: ProjectState | undefined

			try {
				existingState = await this.get(cacheKey)
			} catch (getError) {
				logger.warn("Failed to get existing state, will create new", getError)
			}

			const stateToSave: ProjectState = {
				...existingState,
				...projectState,
				id: cacheKey,
				updatedAt: Date.now(),
				createdAt: existingState?.createdAt || Date.now(),
			}

			// 保存前验证
			if (!this.validateProjectState(stateToSave)) {
				logger.error("saveProjectState: Invalid state data", stateToSave)
				return
			}

			// 净化数据，移除不可被 IndexedDB 结构化克隆的值（如 MobX Proxy、函数等）
			const sanitizedState = this.sanitizeForStorage(stateToSave)
			await this.put(sanitizedState)
		} catch (error: any) {
			// 检查是否是表不存在的错误（数据库版本未升级）
			const isTableNotExistError =
				error?.message?.includes("Table does not exist") ||
				error?.inner?.message?.includes("Table does not exist") ||
				error?.name === "NotFoundError"

			if (isTableNotExistError) {
				logger.error(
					"saveProjectState: Table not found, falling back to memory cache only",
					ProjectStateRepository.tableName,
				)
			} else {
				logger.error("saveProjectStateError", ProjectStateRepository.tableName, error)
			}
		} finally {
			// 同时保存到内存缓存（即使主保存失败）
			try {
				const cacheKey = this.getCacheKey(
					projectState.organization_code,
					projectState.project_id,
				)
				const existingState = Storage.get(`${ProjectStateRepository.tableName}:${cacheKey}`)

				const fallbackState = {
					...existingState,
					...projectState,
					id: cacheKey,
					updatedAt: Date.now(),
					createdAt: existingState?.createdAt || Date.now(),
				}

				if (this.validateProjectState(fallbackState)) {
					Storage.set(`${ProjectStateRepository.tableName}:${cacheKey}`, fallbackState)
				}
			} catch (fallbackError) {
				logger.error("saveProjectState: Fallback save failed", fallbackError)
			}
		}
	}

	/**
	 * 更新文件状态（部分更新，保留未传入的字段）
	 */
	public async updateFileState(
		organizationCode: string,
		projectId: string,
		fileState: Partial<FileState>,
	): Promise<void> {
		const existingState = await this.getProjectState(organizationCode, projectId)

		// 合并文件状态，确保必需字段有默认值
		const mergedFileState: FileState = {
			tabs: [],
			...existingState?.fileState,
			...fileState,
		}

		await this.saveProjectState({
			organization_code: organizationCode,
			project_id: projectId,
			...existingState,
			fileState: mergedFileState,
		})
	}

	/**
	 * 更新树形展开状态
	 */
	public async updateTreeState(
		organizationCode: string,
		projectId: string,
		treeState: TreeState,
	): Promise<void> {
		const existingState = await this.getProjectState(organizationCode, projectId)

		await this.saveProjectState({
			organization_code: organizationCode,
			project_id: projectId,
			...existingState,
			treeState,
		})
	}

	/**
	 * 更新搜索状态
	 */
	public async updateSearchState(
		organizationCode: string,
		projectId: string,
		searchState: SearchState,
	): Promise<void> {
		const existingState = await this.getProjectState(organizationCode, projectId)

		await this.saveProjectState({
			organization_code: organizationCode,
			project_id: projectId,
			...existingState,
			searchState,
		})
	}

	/**
	 * 更新UI状态
	 */
	public async updateUIState(
		organizationCode: string,
		projectId: string,
		uiState: UIState,
	): Promise<void> {
		const existingState = await this.getProjectState(organizationCode, projectId)

		await this.saveProjectState({
			organization_code: organizationCode,
			project_id: projectId,
			...existingState,
			uiState,
		})
	}

	/**
	 * 删除项目状态缓存
	 */
	public async deleteProjectState(organizationCode: string, projectId: string): Promise<void> {
		try {
			const cacheKey = this.getCacheKey(organizationCode, projectId)
			await this.delete(cacheKey)
		} catch (error) {
			logger.error("deleteProjectStateError", ProjectStateRepository.tableName, error)
		} finally {
			// 同时删除内存缓存
			const cacheKey = this.getCacheKey(organizationCode, projectId)
			Storage.remove(`${ProjectStateRepository.tableName}:${cacheKey}`)
		}
	}

	/**
	 * 获取所有项目状态缓存
	 */
	public async getAllProjectStates(): Promise<ProjectState[]> {
		try {
			return await this.getAll()
		} catch (error) {
			logger.error("getAllProjectStatesError", ProjectStateRepository.tableName, error)
			return Storage.getAll<ProjectState>(`${ProjectStateRepository.tableName}:`)
		}
	}

	/**
	 * 🔧 调试工具：查看所有缓存状态 (仅开发环境使用)
	 */
	public async debugViewAllCache(): Promise<void> {
		if (process.env.NODE_ENV !== "development") {
			console.warn("🚫 Debug tools only available in development mode")
			return
		}

		try {
			console.group("🔍 ProjectState 缓存调试信息")

			// 1. 首先检查 IndexedDB 数据
			console.log("📊 正在检查 IndexedDB...")
			const indexedDBStates = await this.getAllProjectStates()
			console.log(`💾 IndexedDB 中的项目数: ${indexedDBStates.length}`)

			// 2. 检查内存缓存数据
			console.log("📊 正在检查内存缓存...")
			const memoryKeys = Object.keys(localStorage).filter((key) =>
				key.includes(`${ProjectStateRepository.tableName}:`),
			)
			console.log(`🧠 内存缓存中的项目数: ${memoryKeys.length}`)
			console.log("🔑 内存缓存键:", memoryKeys)

			const memoryStates: ProjectState[] = []
			memoryKeys.forEach((key) => {
				try {
					const data = localStorage.getItem(key)
					if (data) {
						const parsed = JSON.parse(data)
						if (this.validateProjectState(parsed)) {
							memoryStates.push(parsed)
						}
					}
				} catch (e) {
					console.warn(`⚠️ 无法解析内存缓存键: ${key}`, e)
				}
			})

			// 3. 合并所有数据源
			const allStates = [...indexedDBStates, ...memoryStates]

			// 去重（基于 organization_code + project_id）
			const uniqueStates = allStates.filter((state, index, array) => {
				const key = `${state.organization_code}_${state.project_id}`
				return (
					array.findIndex((s) => `${s.organization_code}_${s.project_id}` === key) ===
					index
				)
			})

			console.log(`📊 总缓存项目数 (去重后): ${uniqueStates.length}`)

			if (uniqueStates.length === 0) {
				console.log("📭 没有找到任何缓存数据")
				console.log("🔧 调试提示:")
				console.log("   1. 检查是否正确保存了数据")
				console.log("   2. 检查 tableName 是否一致")
				console.log("   3. 查看浏览器 Application -> IndexedDB")
				console.groupEnd()
				return
			}

			uniqueStates.forEach((state, index) => {
				console.group(
					`📁 项目 ${index + 1}: ${state.organization_code}/${state.project_id}`,
				)

				// 文件状态信息
				if (state.fileState) {
					console.log(`📄 文件标签页: ${state.fileState.tabs?.length || 0} 个`)
					console.log(`🎯 活跃标签页: ${state.fileState.activeTabId || "无"}`)

					// 详情状态
					if (state.fileState.detailState) {
						console.log(`🔍 详情状态:`)
						console.log(
							`   autoDetail: ${state.fileState.detailState.autoDetail ? "有" : "无"
							}`,
						)
						console.log(
							`   userDetail: ${state.fileState.detailState.userDetail ? "有" : "无"
							}`,
						)
					}

					// PPT ActiveIndex 缓存信息
					if (state.fileState.pptActiveIndexMap) {
						const pptCount = Object.keys(state.fileState.pptActiveIndexMap).length
						console.log(`📊 PPT 页面索引缓存: ${pptCount} 个文件`)
						if (pptCount > 0) {
							console.log("   缓存详情:", state.fileState.pptActiveIndexMap)
						}
					}

					if (state.fileState.tabs?.length > 0) {
						console.table(
							state.fileState.tabs.map((tab) => ({
								ID: tab.id,
								文件名: tab.title,
								是否活跃: tab.active ? "✅" : "❌",
								文件路径: tab.filePath,
							})),
						)
					}
				} else {
					console.log("📄 文件状态: 未设置")
				}

				// 树状态信息
				if (state.treeState) {
					console.log(`🌳 展开的文件夹: ${state.treeState.expandedKeys?.length || 0} 个`)
					if (state.treeState.expandedKeys?.length > 0) {
						console.log("🔽 展开的路径:", state.treeState.expandedKeys)
					}
				} else {
					console.log("🌳 树状态: 未设置")
				}

				// 时间信息
				console.log(`⏰ 创建时间: ${new Date(state.createdAt || 0).toLocaleString()}`)
				console.log(`🔄 更新时间: ${new Date(state.updatedAt || 0).toLocaleString()}`)

				console.groupEnd()
			})

			console.groupEnd()
		} catch (error) {
			console.error("❌ 查看缓存失败:", error)
		}
	}

	/**
	 * 🧹 调试工具：清理所有缓存 (仅开发环境使用)
	 */
	public async debugClearAllCache(): Promise<void> {
		if (process.env.NODE_ENV !== "development") {
			console.warn("🚫 Debug tools only available in development mode")
			return
		}

		try {
			const allStates = await this.getAllProjectStates()

			for (const state of allStates) {
				if (state.id) {
					await this.delete(state.id)
				}
			}

			// 清理内存缓存
			const memoryKeys = Object.keys(localStorage).filter((key) =>
				key.includes(`${ProjectStateRepository.tableName}:`),
			)
			memoryKeys.forEach((key) => localStorage.removeItem(key))

			console.log(
				`🧹 已清理 ${allStates.length} 个项目缓存和 ${memoryKeys.length} 个内存缓存`,
			)
		} catch (error) {
			console.error("❌ 清理缓存失败:", error)
		}
	}

	/**
	 * 清理过期的缓存（超过30天的缓存）
	 */
	public async cleanExpiredCache(): Promise<void> {
		try {
			const allStates = await this.getAllProjectStates()
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

			const expiredStates = allStates.filter(
				(state) => (state.updatedAt || 0) < thirtyDaysAgo,
			)

			for (const state of expiredStates) {
				if (state.id) {
					await this.delete(state.id)
				}
			}

			console.log(`🧹 Cleaned ${expiredStates.length} expired project state caches`)
		} catch (error) {
			logger.error("cleanExpiredCacheError", ProjectStateRepository.tableName, error)
		}
	}
}

// 将调试函数添加到全局 window 对象 (仅开发环境)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
	const debugRepo = new ProjectStateRepository()
		; (window as any).debugProjectCache = {
			view: () => debugRepo.debugViewAllCache(),
			clear: () => debugRepo.debugClearAllCache(),
			help: () => {
				console.log(`
🔧 项目缓存调试工具使用说明:

1. 查看所有缓存:
   debugProjectCache.view()

2. 清理所有缓存:
   debugProjectCache.clear()

3. 显示帮助:
   debugProjectCache.help()

注意: view() 方法已包含所有状态信息，包括文件标签和树展开状态
			`)
			},
		}
}

// 导出类型供其他模块使用
export type { ProjectState, CachedTabItem, FileState, TreeState, SearchState, UIState }

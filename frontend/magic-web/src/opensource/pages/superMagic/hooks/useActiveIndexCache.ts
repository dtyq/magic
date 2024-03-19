import { useEffect, useMemo, useCallback } from "react"
import { useDebounceFn } from "ahooks"
import { useOrganization } from "@/opensource/models/user/hooks/useOrganization"
import { ProjectStateRepository } from "@/opensource/models/config/repositories/SuperProjectStateRepository"
import { getSuperIdState } from "../utils/query"
import { WorkspaceStateCache } from "../utils/superMagicCache"
import { userStore } from "@/opensource/models/user"

interface UseActiveIndexCacheOptions {
	selectedProjectId?: string
	fileId?: string
	activeIndex: number
	setActiveIndex: (index: number) => void
}

/**
 * @deprecated 此 hook 已废弃，缓存逻辑已迁移到 PPTStore 中管理
 *
 * 迁移说明：
 * - PPTStore 现在内置了 PPTActiveIndexCacheManager 来管理 activeIndex 缓存
 * - 缓存的保存和恢复由 Store 内部自动处理，无需外部手动调用
 * - 使用 PPTStore 的 `updateCacheConfig()` 方法更新缓存配置
 * - 使用 PPTStore 的 `restoreCachedActiveIndex()` 方法手动恢复缓存（通常不需要）
 *
 * 新架构优势：
 * - 状态管理更加内聚，activeIndex 和缓存逻辑都在 Store 中
 * - 减少了组件间的状态传递
 * - 更易于测试和维护
 *
 * 此函数保留用于向后兼容，但不再推荐使用
 * 请迁移到使用 PPTStore 的内置缓存功能
 *
 * 处理 PPT activeIndex 的缓存逻辑
 * 1. 项目和文件变化时恢复缓存的 activeIndex
 * 2. activeIndex 变化时保存到缓存
 */
export function useActiveIndexCache({
	selectedProjectId,
	fileId,
	activeIndex,
	setActiveIndex,
}: UseActiveIndexCacheOptions) {
	const { organizationCode } = useOrganization()
	const projectStateRepository = useMemo(() => new ProjectStateRepository(), [])

	// 保存 activeIndex 到缓存
	const saveIndexToCache = useCallback(
		async (index: number, fId?: string) => {
			if (!organizationCode || !selectedProjectId || !fId) {
				return
			}

			try {
				// 获取当前的文件状态，保持现有的其他状态不变
				const currentState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProjectId,
				)

				const pptActiveIndexMap = {
					...(currentState?.fileState?.pptActiveIndexMap || {}),
					[fId]: index,
				}

				const fileState = {
					tabs: currentState?.fileState?.tabs || [],
					activeTabId: currentState?.fileState?.activeTabId,
					detailMode: currentState?.fileState?.detailMode,
					singleModeDetail: currentState?.fileState?.singleModeDetail,
					pptActiveIndexMap,
				}

				await projectStateRepository.updateFileState(
					organizationCode,
					selectedProjectId,
					fileState,
				)

				console.log("💾 PPT activeIndex 已保存到缓存:", {
					fileId: fId,
					activeIndex: index,
				})
			} catch (error) {
				console.error("❌ 保存 PPT activeIndex 到缓存失败:", error)
			}
		},
		[organizationCode, selectedProjectId, projectStateRepository],
	)

	// 防抖保存
	const { run: debouncedSaveIndex } = useDebounceFn(
		(index: number, fId?: string) => {
			saveIndexToCache(index, fId)
		},
		{ wait: 500 },
	)

	// 项目或文件变化时加载缓存
	useEffect(() => {
		if (!organizationCode || !selectedProjectId || !fileId) {
			return
		}

		const loadCachedIndex = async () => {
			try {
				const cachedState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProjectId,
				)

				if (cachedState?.fileState?.pptActiveIndexMap) {
					const cachedIndex = cachedState.fileState.pptActiveIndexMap[fileId]

					// 检查必要的状态是否已经准备好
					const checkAndRestoreIndex = (retryCount = 0) => {
						// 使用和 API 相同的方式检查状态
						const workspaceState = WorkspaceStateCache.get(userStore.user.userInfo)
						const superIdState = getSuperIdState()

						const projectId =
							(window as any).project_id ||
							workspaceState?.projectId ||
							superIdState?.projectId

						// 检查 projectId 是否存在且与选中的项目ID一致
						const isProjectIdValid = projectId && projectId === selectedProjectId

						if (!isProjectIdValid && retryCount < 10) {
							// 如果 project_id 还没准备好或不一致，100ms 后重试，最多重试10次
							setTimeout(() => checkAndRestoreIndex(retryCount + 1), 100)
							return
						}

						if (!isProjectIdValid) {
							console.warn(
								"⚠️ project_id 未准备好或与选中项目不一致，跳过 activeIndex 缓存恢复",
								{
									projectId,
									selectedProjectId,
								},
							)
							return
						}

						if (typeof cachedIndex === "number" && cachedIndex >= 0) {
							console.log("🔄 恢复缓存的 PPT activeIndex:", {
								fileId,
								activeIndex: cachedIndex,
							})
							setActiveIndex(cachedIndex)
						}
					}

					checkAndRestoreIndex()
				}
			} catch (error) {
				console.error("❌ 加载缓存 PPT activeIndex 失败:", error)
			}
		}

		loadCachedIndex()
	}, [organizationCode, selectedProjectId, fileId])

	// 监听 activeIndex 变化并保存
	useEffect(() => {
		if (organizationCode && selectedProjectId && fileId && typeof activeIndex === "number") {
			debouncedSaveIndex(activeIndex, fileId)
		}
	}, [activeIndex, organizationCode, selectedProjectId, fileId, debouncedSaveIndex])

	return {
		organizationCode,
		projectStateRepository,
	}
}

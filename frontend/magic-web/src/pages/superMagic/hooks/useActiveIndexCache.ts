import { useEffect, useMemo, useCallback } from "react"
import { useDebounceFn } from "ahooks"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"

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
					if (typeof cachedIndex === "number" && cachedIndex >= 0) {
						setActiveIndex(cachedIndex)
					}
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

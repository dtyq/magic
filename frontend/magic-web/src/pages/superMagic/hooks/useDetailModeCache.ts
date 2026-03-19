import { useEffect, useMemo, useCallback } from "react"
import { useDebounceFn, useUpdateEffect } from "ahooks"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import { getSuperIdState } from "../utils/query"
import { WorkspaceStateCache } from "../utils/superMagicCache"
import { userStore } from "@/models/user"

interface UseDetailModeCacheOptions {
	selectedProjectId?: string
	autoDetail?: any
	userDetail?: any
	setAutoDetail: (detail: any) => void
	setUserDetail: (detail: any) => void
}

/**
 * 处理详情状态的缓存逻辑
 * 1. 项目变化时恢复缓存的详情状态
 * 2. 状态变化时保存到缓存
 */
export function useDetailModeCache({
	selectedProjectId,
	autoDetail,
	userDetail,
	setAutoDetail,
	setUserDetail,
}: UseDetailModeCacheOptions) {
	const { organizationCode } = useOrganization()
	const projectStateRepository = useMemo(() => new ProjectStateRepository(), [])

	// 保存状态到缓存
	const saveStateToCache = useCallback(
		async (auto?: any, user?: any) => {
			if (!organizationCode || !selectedProjectId) {
				return
			}

			try {
				// 获取当前的文件状态，保持现有的 tabs 不变
				const currentState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProjectId,
				)

				const fileState = {
					tabs: currentState?.fileState?.tabs || [],
					activeTabId: currentState?.fileState?.activeTabId,
					detailState: {
						autoDetail: auto,
						userDetail: user,
					},
				}

				await projectStateRepository.updateFileState(
					organizationCode,
					selectedProjectId,
					fileState,
				)
			} catch (error) {
				console.error("❌ 保存详情状态到缓存失败:", error)
			}
		},
		[organizationCode, selectedProjectId, projectStateRepository],
	)

	// 防抖保存
	const { run: debouncedSaveState } = useDebounceFn(
		(auto?: any, user?: any) => {
			saveStateToCache(auto, user)
		},
		{ wait: 500 },
	)

	// 项目变化时加载缓存
	useUpdateEffect(() => {
		if (!organizationCode || !selectedProjectId) {
			return
		}

		const loadCachedState = async () => {
			try {
				const cachedState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProjectId,
				)

				if (cachedState?.fileState?.detailState) {
					const { detailState } = cachedState.fileState

					// 检查必要的状态是否已经准备好
					const checkAndRestoreState = (retryCount = 0) => {
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
							setTimeout(() => checkAndRestoreState(retryCount + 1), 100)
							return
						}

						if (!isProjectIdValid) {
							console.warn("⚠️ project_id 未准备好或与选中项目不一致，跳过缓存恢复", {
								projectId,
								selectedProjectId,
							})
							return
						}

						// 优先恢复 userDetail，其次是 autoDetail
						if (detailState.userDetail) {
							console.log("🔄 恢复 userDetail")
							setUserDetail(detailState.userDetail)
						} else if (detailState.autoDetail) {
							console.log("🔄 恢复 autoDetail")
							setAutoDetail(detailState.autoDetail)
						}
					}

					checkAndRestoreState()
				}
			} catch (error) {
				console.error("❌ 加载缓存详情状态失败:", error)
			}
		}

		loadCachedState()
	}, [organizationCode, selectedProjectId])

	// 监听状态变化并保存
	useEffect(() => {
		if (organizationCode && selectedProjectId) {
			debouncedSaveState(autoDetail, userDetail)
		}
	}, [autoDetail, userDetail, organizationCode, selectedProjectId, debouncedSaveState])

	return {
		organizationCode,
		projectStateRepository,
	}
}

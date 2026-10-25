import { useEffect, useMemo, useCallback } from "react"
import { useDebounceFn, useUpdateEffect } from "ahooks"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"

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
				const fileState = {
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
					if (detailState.userDetail) {
						setUserDetail(detailState.userDetail)
					} else if (detailState.autoDetail) {
						setAutoDetail(detailState.autoDetail)
					}
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

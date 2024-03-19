import { useState, useMemo, useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/opensource/pages/superMagic/utils/api"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UsePPTVersionManagerProps {
	/** 用于版本管理的文件 ID */
	fileId: string
}

interface UsePPTVersionManagerReturn {
	/** 当前查看的版本号（undefined 表示最新版本） */
	fileVersion: number | undefined
	/** 可用版本列表 */
	fileVersionsList: FileHistoryVersion[]
	/** 是否正在查看最新版本 */
	isNewestVersion: boolean
	/** 选中版本的内容 */
	versionContent: string | null
	/** 版本操作的加载状态 */
	isLoadingVersion: boolean
	/** 切换到指定版本或返回最新版本（undefined） */
	changeFileVersion: (version: number | undefined) => Promise<void>
	/** 获取并刷新版本列表 */
	fetchFileVersions: (fileId: string, forceRefresh?: boolean) => Promise<FileHistoryVersion[]>
	/** 回滚到指定版本（使用旧内容创建新版本） */
	handleVersionRollback: (version: number) => Promise<void>
	/** 获取指定版本内容用于对比（不改变当前版本） */
	getVersionContentForCompare: (version: number) => Promise<string | null>
}

/**
 * PPT 版本管理 Hook
 * 专门用于管理 PPT 幻灯片版本的简化 hook
 */
export function usePPTVersionManager({
	fileId,
}: UsePPTVersionManagerProps): UsePPTVersionManagerReturn {
	const { t } = useTranslation("super")

	// 状态管理
	const [fileVersion, setFileVersion] = useState<number | undefined>(undefined)
	const [fileVersionsList, setFileVersionsList] = useState<FileHistoryVersion[]>([])
	const [versionContent, setVersionContent] = useState<string | null>(null)
	const [isLoadingVersion, setIsLoadingVersion] = useState(false)

	// 检查是否正在查看最新版本
	const isNewestVersion = useMemo(() => {
		return !fileVersion || fileVersion === fileVersionsList[0]?.version
	}, [fileVersion, fileVersionsList])

	/**
	 * 从服务器获取文件版本列表
	 */
	const fetchFileVersions = useMemoizedFn(
		async (targetFileId: string, forceRefresh = false): Promise<FileHistoryVersion[]> => {
			try {
				const res = await SuperMagicApi.getFileHistoryVersions({
					file_id: targetFileId,
					page_size: 10,
				})

				if (res?.list) {
					setFileVersionsList(res.list)
					// 如果强制刷新且正在查看历史版本，更新到最新版本
					if (forceRefresh && fileVersion === undefined) {
						setVersionContent(null)
					}
					return res.list
				} else {
					setFileVersionsList([])
					return []
				}
			} catch (error) {
				console.error("Failed to fetch file versions:", error)
				setFileVersionsList([])
				return []
			}
		},
	)

	/**
	 * 下载指定版本的文件内容（不改变当前版本状态）
	 */
	const downloadVersionContent = useCallback(
		async (targetVersion: number | undefined): Promise<string | null> => {
			if (!fileId) return null

			try {
				setIsLoadingVersion(true)

				// 获取版本的临时下载 URL
				const urlRes = await getTemporaryDownloadUrl({
					file_ids: [fileId],
					file_versions: targetVersion ? { [fileId]: targetVersion } : undefined,
				})

				if (!urlRes[0]?.url) {
					magicToast.error(t("common.fileUrlFetchFailed"))
					return null
				}

				// 下载文件内容
				const content = await downloadFileContent(urlRes[0].url, { responseType: "text" })
				return content as string
			} catch (error) {
				console.error("Failed to download version content:", error)
				magicToast.error(t("common.fileDownloadFailed"))
				return null
			} finally {
				setIsLoadingVersion(false)
			}
		},
		[fileId, t],
	)

	/**
	 * 获取指定版本的内容用于对比（不改变当前显示的版本）
	 */
	const getVersionContentForCompare = useMemoizedFn(
		async (targetVersion: number): Promise<string | null> => {
			return await downloadVersionContent(targetVersion)
		},
	)

	/**
	 * 切换到指定版本或返回最新版本（undefined）
	 */
	const changeFileVersion = useMemoizedFn(async (targetVersion: number | undefined) => {
		if (!fileId) return
		if (targetVersion !== undefined && targetVersion === fileVersion) return

		setFileVersion(targetVersion)

		// 如果切换到历史版本，获取其内容
		if (targetVersion !== undefined) {
			const content = await downloadVersionContent(targetVersion)
			setVersionContent(content)
		} else {
			// 返回最新版本 - 清除版本内容
			setVersionContent(null)
		}
	})

	/**
	 * 回滚到指定版本（使用旧内容创建新版本）
	 */
	const handleVersionRollback = useMemoizedFn(async (targetVersion: number) => {
		if (!fileId || !targetVersion) return

		const loading = magicToast.loading(t("common.rollbacking"))

		try {
			const res = await SuperMagicApi.rollbackFileVersion({
				file_id: fileId,
				version: targetVersion,
			})

			if (res) {
				// 回滚后刷新版本列表
				const list = await fetchFileVersions(fileId)

				if (list && list.length > 0) {
					// 回滚后切换到新的最新版本
					await changeFileVersion(undefined)
					magicToast.destroy(loading)
					magicToast.success(t("common.rollbackSuccess"))
				}
			}
		} catch (error) {
			console.error("Version rollback failed:", error)
			magicToast.destroy(loading)
			magicToast.error(t("common.rollbackFailed"))
		}
	})

	return {
		fileVersion,
		fileVersionsList,
		isNewestVersion,
		versionContent,
		isLoadingVersion,
		changeFileVersion,
		fetchFileVersions,
		handleVersionRollback,
		getVersionContentForCompare,
	}
}

import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useMemo, useState } from "react"
import { useDebounceEffect, useMemoizedFn } from "ahooks"
import { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import useShareRoute from "./useShareRoute"
import { SuperMagicApi } from "@/apis"
import type { GetTemporaryDownloadUrlItem } from "@/pages/superMagic/utils/api"
import { parseExpiresAt } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import { SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS } from "@/pages/superMagic/services/sharedMediaUrlCache"

export interface SlideFileData {
	fileId: string
	fileUrl: string
	fileVersion: number | undefined
	fileVersionsList: FileHistoryVersion[]
	fileUrlVersionMap: Record<number, GetTemporaryDownloadUrlItem>
}

export const useSlidesFileData = ({
	currentSildeFileId,
	isEditing = false,
	updatedAt,
}: {
	currentSildeFileId: string
	isEditing?: boolean
	updatedAt?: string
}) => {
	const { t } = useTranslation("super")
	const { isShareRoute, isMagicShareRoute } = useShareRoute()
	const fileAccess = useFileAccess()
	// Bind the ambient share/session identity so slide version URLs resolve on share
	// previews as well as in the host session.
	const fileApi = useFileApi()

	/** 每一页PPT文件的数据 */
	const [slidesFileDataMap, setSlidesFileDataMap] = useState<Record<string, SlideFileData>>({})

	/** 更改文件版本 */
	const changeFileVersion = useMemoizedFn((file_version: number | undefined) => {
		if (!currentSildeFileId) {
			return
		}
		const currentSlide = slidesFileDataMap[currentSildeFileId]
		const currentVersion = file_version || currentSlide?.fileVersionsList[0]?.version
		const currentResource = currentSlide?.fileUrlVersionMap?.[currentVersion]
		const currentExpiresAt = parseExpiresAt(currentResource?.expires_at)
		const currentResourceUsable =
			Boolean(currentResource?.url) &&
			(currentExpiresAt === null ||
				currentExpiresAt - Date.now() > SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS)
		if (file_version === currentSlide?.fileVersion && currentResourceUsable) return
		// 1. 获取对应版本的文件地址：
		// 优先使用已缓存的文件地址
		const targetFileResource =
			slidesFileDataMap[currentSildeFileId]?.fileUrlVersionMap?.[currentVersion]
		const targetExpiresAt = parseExpiresAt(targetFileResource?.expires_at)
		const targetResourceUsable =
			Boolean(targetFileResource?.url) &&
			(targetExpiresAt === null ||
				targetExpiresAt - Date.now() > SHARED_MEDIA_URL_EXPIRY_SAFETY_WINDOW_MS)
		// 只有仍在安全有效期内的完整链接记录才能直接复用。
		if (targetResourceUsable && targetFileResource) {
			setSlidesFileDataMap((prev) => ({
				...prev,
				[currentSildeFileId]: {
					...prev[currentSildeFileId],
					fileUrl: targetFileResource.url,
					fileVersion: file_version,
				},
			}))
		} else {
			if (shouldWaitForShareAccess(fileAccess)) return
			// 获取文件下载地址
			fileApi
				.requestSharedMediaUrls([currentSildeFileId], {
					fileVersions: file_version ? { [currentSildeFileId]: file_version } : undefined,
					fileUpdatedAtMap: updatedAt ? { [currentSildeFileId]: updatedAt } : undefined,
				})
				.then((res) => {
					const resource = res[0]
					if (!resource) return
					setSlidesFileDataMap((prev) => ({
						...prev,
						[currentSildeFileId]: {
							...prev[currentSildeFileId],
							fileUrl: resource.url,
							fileVersion: file_version,
							fileUrlVersionMap: file_version
								? {
										...(prev[currentSildeFileId]?.fileUrlVersionMap || {}),
										[file_version ||
										prev[currentSildeFileId]?.fileVersionsList[0]?.version]:
											resource,
									}
								: {
										...(prev[currentSildeFileId]?.fileUrlVersionMap || {}),
									},
						},
					}))
				})
		}
	})

	/**
	 * 获取文件版本列表
	 * @param fileId 文件ID
	 * @param isSelectNewest 是否自动更新当前文件为最新版本的文件数据
	 * @returns 文件版本列表
	 */
	const fetchFileVersions = useMemoizedFn(async (fileId: string, isSelectNewest = false) => {
		try {
			const res = await SuperMagicApi.getFileHistoryVersions({
				file_id: fileId,
				page_size: 10,
			})
			if (res && res.list) {
				// 初始加载时，替换列表
				setSlidesFileDataMap((prev) => {
					return {
						...prev,
						[fileId]: { ...prev[fileId], fileVersionsList: res.list },
					}
				})
				if (isSelectNewest) {
					setSlidesFileDataMap((prev) => ({
						...prev,
						[currentSildeFileId]: {
							...prev[currentSildeFileId],
							fileVersion: undefined,
						},
					}))
				}
				return res.list
			} else {
				setSlidesFileDataMap((prev) => ({
					...prev,
					[fileId]: { ...prev[fileId], fileVersionsList: [] },
				}))
				return []
			}
		} catch (error) {
			console.error("🚀 ~ CommonFooter ~ error:", error)
			setSlidesFileDataMap((prev) => ({
				...prev,
				[fileId]: { ...prev[fileId], fileVersionsList: [] },
			}))
			return []
		}
	})

	/** 还原文件版本 */
	const handleVersionRollback = useMemoizedFn(async (file_version?: number) => {
		try {
			if (!currentSildeFileId || !file_version) return
			const res = await SuperMagicApi.rollbackFileVersion({
				file_id: currentSildeFileId,
				version: file_version,
			})
			if (res) {
				const list = await fetchFileVersions(currentSildeFileId)
				if (list && list.length > 0) {
					setSlidesFileDataMap((prev) => ({
						...prev,
						[currentSildeFileId]: {
							...prev[currentSildeFileId],
							fileVersion: list[0]?.version,
						},
					}))
					magicToast.success(t("common.rollbackSuccess"))
				}
			}
		} catch (error) {
			console.log("🚀 ~ error:", error)
		}
	})

	/** 当前PPT页面是否是最新版本 */
	const isNewestVersion = useMemo(() => {
		const currentFileVersion = slidesFileDataMap[currentSildeFileId]?.fileVersion
		const currentFileVersions = slidesFileDataMap[currentSildeFileId]?.fileVersionsList
		return !currentFileVersion || currentFileVersion === currentFileVersions?.[0]?.version
	}, [slidesFileDataMap, currentSildeFileId])

	/** PPT切换页面时，会触发此hook */
	useDebounceEffect(
		() => {
			if (!currentSildeFileId || isEditing || isShareRoute || isMagicShareRoute) return

			const targetSlideFileData = slidesFileDataMap[currentSildeFileId]
			// 1. 如果内存中没有初始化 目标PPT页面 的数据，则初始化
			if (!targetSlideFileData) {
				setSlidesFileDataMap((prev) => ({
					...prev,
					[currentSildeFileId]: {
						...prev[currentSildeFileId],
						fileId: currentSildeFileId,
					},
				}))
			}

			// 2. 获取当前PPT页面的文件版本列表
			// 切换PPT页面时，需要选中最新版本
			const currentFileVersions = targetSlideFileData?.fileVersionsList
			if (!currentFileVersions || currentFileVersions.length === 0) {
				fetchFileVersions(currentSildeFileId, true)
			} else {
				changeFileVersion(undefined)
			}
		},
		[currentSildeFileId, updatedAt],
		{
			wait: 100,
		},
	)

	return {
		slidesFileDataMap,
		fileVersion: slidesFileDataMap[currentSildeFileId]?.fileVersion,
		changeFileVersion,
		fetchFileVersions,
		handleVersionRollback,
		isNewestVersion,
	}
}

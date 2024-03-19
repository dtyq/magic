import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/opensource/pages/superMagic/utils/api"
import { useEffect, useMemo, useRef, useState } from "react"
import { useDebounceEffect, useMemoizedFn } from "ahooks"
import { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import useShareRoute from "./useShareRoute"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { SuperMagicApi } from "@/opensource/apis"
import { isNil } from "lodash-es"

interface FileUrlCache {
	url: string
	updatedAt: string
	version?: number
}

export const useFileData = ({
	file_id,
	responseType = "text",
	isEditing = false,
	updatedAt,
	activeFileId,
	isFromNode = false,
	content,
	disabledUrlCache = false,
}: {
	file_id: string
	responseType?: "text" | "arrayBuffer" | "blob"
	isEditing?: boolean
	updatedAt?: string
	activeFileId?: string | null
	isFromNode?: boolean
	content?: string
	disabledUrlCache?: boolean
}) => {
	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()

	/** 文件 URL 缓存 - 存储文件 ID 对应的 URL 和更新时间 */
	const fileUrlCacheRef = useRef<Record<string, FileUrlCache>>({})

	/** 文件地址 */
	const [fileUrl, setFileUrl] = useState<string>("")
	/** 文件数据 */
	const [fileData, setFileData] = useState<any>(null)
	/** 文件版本 */
	const [fileVersion, setFileVersion] = useState<number>()
	/** 版本列表 */
	const [fileVersionsList, setFileVersionsList] = useState<FileHistoryVersion[]>([])
	/** 是否正在加载 */
	const [loading, setLoading] = useState(isNil(content))
	/** 是否是删除的文件 */
	const [isDeleted, setIsDeleted] = useState(false)

	/** 智能更新文件 URL - 只有当更新时间或版本变化时才更新 */
	const updateFileUrlIfNeeded = useMemoizedFn(
		(newUrl: string, fileId: string, newUpdatedAt?: string, newVersion?: number) => {
			// 如果禁用缓存，直接更新 URL 并返回 true
			if (disabledUrlCache) {
				setFileUrl(newUrl)
				return true
			}
			const cachedData = fileUrlCacheRef.current[fileId]
			const currentUpdatedAt = newUpdatedAt || updatedAt || ""
			// 检查是否需要更新：没有缓存数据、更新时间不同、版本不同
			const shouldUpdate =
				!cachedData ||
				cachedData.updatedAt !== currentUpdatedAt ||
				cachedData.version !== newVersion

			if (shouldUpdate) {
				fileUrlCacheRef.current[fileId] = {
					url: newUrl,
					updatedAt: currentUpdatedAt,
					version: newVersion,
				}
				setFileUrl(newUrl)
				return true
			} else {
				return false
			}
		},
	)

	/** 更改文件版本 */
	const changeFileVersion = useMemoizedFn(
		(file_version: number | undefined, fileVersionsList?: FileHistoryVersion[]) => {
			if (!file_id || (file_version && file_version === fileVersion)) return
			// 获取文件下载地址
			getTemporaryDownloadUrl({
				file_ids: [file_id],
				file_versions: file_version ? { [file_id]: file_version } : undefined,
			})
				.then((res: any) => {
					if (res[0]?.url) {
						setIsDeleted(false)
						// 使用智能更新函数，只有当更新时间或版本变化时才更新 URL
						const urlUpdated = updateFileUrlIfNeeded(
							res[0]?.url,
							file_id,
							updatedAt,
							file_version,
						)
						setFileVersion(file_version)
						if (fileVersionsList) {
							setFileVersionsList(fileVersionsList)
						}
						pubsub.publish(
							PubSubEvents.Change_Preview_File_Version,
							file_id,
							file_version,
						)
						// 只有 URL 更新时才重新下载文件内容
						if (urlUpdated) {
							return downloadFileContent(res[0]?.url, { responseType }).then(
								(data: any) => {
									if (fileData === data) return
									setFileData(data)
									setLoading(false)
								},
							)
						} else {
							setLoading(false)
						}
					} else {
						setIsDeleted(true)
						setLoading(false)
						magicToast.error(t("common.fileUrlFetchFailed"))
						return Promise.reject(new Error(t("common.fileUrlFetchFailed")))
					}
				})
				.catch(() => {
					setLoading(false)
				})
		},
	)

	/**
	 * 获取文件版本列表
	 * @param fileId 文件ID
	 * @param page_size 每页数量（用于分页）
	 * @param isLoadMore 是否加载更多（用于分页）
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
				if (isSelectNewest) {
					changeFileVersion(undefined, res.list)
				} else {
					setFileVersionsList(res.list)
				}
				return res.list
			} else {
				setFileVersionsList([])
				return []
			}
		} catch (error) {
			console.error("🚀 ~ CommonFooter ~ error:", error)
			setFileVersionsList([])
			return []
		}
	})

	/** 还原文件版本 */
	const handleVersionRollback = useMemoizedFn(async (file_version?: number) => {
		try {
			if (!file_id || !file_version) return

			const loading = magicToast.loading(t("common.rollbacking"))

			const res = await SuperMagicApi.rollbackFileVersion({
				file_id,
				version: file_version,
			})
			if (res) {
				const list = await fetchFileVersions(file_id)
				if (list && list.length > 0) {
					setFileVersion?.(list[0].version)
					magicToast.destroy(loading)
					magicToast.success(t("common.rollbackSuccess"))
				}
			}
		} catch (error) {
			console.log("🚀 ~ error:", error)
		}
	})

	/** 是否是最新版本 */
	const isNewestVersion = useMemo(() => {
		return !fileVersion || fileVersion === fileVersionsList[0]?.version
	}, [fileVersion, fileVersionsList])

	const getFileVersion = useMemoizedFn(async (file_id: string, isSelectNewest?: boolean) => {
		// 获取文件版本列表
		fetchFileVersions(file_id, isSelectNewest)
	})

	useDebounceEffect(
		() => {
			// 如果正在编辑但文件数据还没有加载，需要先加载文件
			if (isEditing && !fileData && file_id && activeFileId === file_id && !isShareRoute) {
				getFileVersion(file_id)
				return
			}
			// 非编辑模式下的正常逻辑
			if (!file_id || isEditing || !activeFileId || activeFileId !== file_id || isShareRoute)
				return
			// 是否正在查看历史版本
			const isViewingHistoryVersion = fileVersion !== undefined
			// 如果用户正在查看历史版本，只更新版本列表，不自动切换到最新版本
			getFileVersion(file_id, !isViewingHistoryVersion)
		},
		[activeFileId, updatedAt, file_id, isEditing, isShareRoute, fileData],
		{
			wait: 100,
		},
	)

	/** 针对 分享/工具预览/内容审查 等场景，单独获取文件的最新下载地址 */
	useEffect(() => {
		if (!file_id) return
		if (isShareRoute || !activeFileId || activeFileId !== file_id) {
			setLoading(true)
			setFileData(null)
			// 获取文件下载地址
			getTemporaryDownloadUrl({
				file_ids: [file_id],
			})
				.then((res: any) => {
					// 使用智能更新函数
					const urlUpdated = updateFileUrlIfNeeded(
						res[0]?.url,
						file_id,
						updatedAt,
						undefined,
					)
					setFileVersion(undefined)
					if (res[0]?.url) {
						setIsDeleted(false)
						// 只有 URL 更新时才重新下载文件内容
						if (urlUpdated) {
							downloadFileContent(res[0]?.url, { responseType }).then((data: any) => {
								setLoading(false)
								setFileData(data)
							})
						} else {
							setLoading(false)
						}
					} else {
						setLoading(false)
						setIsDeleted(true)
					}
				})
				.catch(() => {
					setLoading(false)
				})
		}
	}, [file_id])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Change_Preview_File, () => {
			setFileUrl("")
			setFileData(undefined)
			setFileVersion(undefined)
			setFileVersionsList([])
			// 清空 URL 缓存
			fileUrlCacheRef.current = {}
		})
		return () => {
			pubsub.unsubscribe(PubSubEvents.Change_Preview_File)
		}
	}, [])

	return {
		loading,
		fileUrl,
		fileData,
		setFileData,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		fetchFileVersions,
		handleVersionRollback,
		isNewestVersion,
		isDeleted,
	}
}

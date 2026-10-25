import { useMemo } from "react"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"

interface MenuItem {
	key?: string
	type?: string
	[key: string]: unknown
}

interface UseShareMenuFiltersProps {
	allowDownloadProjectFile?: boolean
	allowCopyProjectFile?: boolean
}

/**
 * 分享页面菜单过滤 Hook
 * 用于根据下载权限过滤文件列表的右键菜单和批量下载菜单
 */
function useShareMenuFilters({
	allowDownloadProjectFile,
	allowCopyProjectFile = false,
}: UseShareMenuFiltersProps) {
	const { isShareRoute } = useShareRoute()

	/**
	 * 过滤右键菜单项
	 * - 非分享页面：返回 undefined，不进行过滤
	 * - 分享页面只保留下载项，以及已登录用户的复制项
	 */
	const filterShareMenuItems = useMemo(() => {
		if (!isShareRoute) return undefined

		return (items: MenuItem[]): MenuItem[] => {
			// 分享页只开放下载和已登录用户的复制操作。
			return items.filter((item) => {
				if (!item || item.type === "divider") return false
				const key = item.key
				return (
					(allowDownloadProjectFile &&
						(key === "download" ||
							key === "downloadOriginal" ||
							key === "downloadFolder" ||
							key === "downloadPdf" ||
							key === "downloadPptx" ||
							key === "downloadPpt" ||
							key === "downloadImage" ||
							key === "downloadImageNoWaterMark")) ||
					(key === "copyFile" && allowCopyProjectFile)
				)
			})
		}
	}, [isShareRoute, allowDownloadProjectFile, allowCopyProjectFile])

	/**
	 * 过滤批量下载菜单项
	 * - 非分享页面：返回 undefined，不进行过滤
	 * - 无下载权限：返回空数组，禁用批量下载入口
	 * - 有下载权限：保留所有菜单项
	 */
	const filterBatchDownloadLayerMenuItems = useMemo(() => {
		if (!isShareRoute) return undefined

		return (items: MenuItem[]): MenuItem[] => {
			// 如果不允许下载，禁用批量下载功能
			if (!allowDownloadProjectFile) return []

			// 允许下载时保留批量下载菜单
			return items
		}
	}, [isShareRoute, allowDownloadProjectFile])

	return {
		filterShareMenuItems,
		filterBatchDownloadLayerMenuItems,
	}
}

export default useShareMenuFilters

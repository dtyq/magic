import { useMemo } from "react"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"

interface MenuItem {
	key?: string
	type?: string
	[key: string]: unknown
}

interface UseShareMenuFiltersProps {
	allowDownloadProjectFile?: boolean
}

/**
 * 分享页面菜单过滤 Hook
 * 用于根据下载权限过滤文件列表的右键菜单和批量下载菜单
 */
function useShareMenuFilters({ allowDownloadProjectFile }: UseShareMenuFiltersProps) {
	const { isShareRoute } = useShareRoute()

	/**
	 * 过滤右键菜单项
	 * - 非分享页面：返回 undefined，不进行过滤
	 * - 无下载权限：返回空数组，隐藏所有菜单
	 * - 有下载权限：只保留下载相关的菜单项
	 */
	const filterShareMenuItems = useMemo(() => {
		if (!isShareRoute) return undefined

		return (items: MenuItem[]): MenuItem[] => {
			// 如果不允许下载，返回空数组
			if (!allowDownloadProjectFile) return []

			// 允许下载时，只保留下载相关菜单
			return items.filter((item) => {
				if (!item || item.type === "divider") return false
				const key = item.key
				return (
					key === "download" ||
					key === "downloadOriginal" ||
					key === "downloadFolder" ||
					key === "downloadPdf" ||
					key === "downloadPpt" ||
					key === "downloadImage" ||
					key === "downloadImageNoWaterMark"
				)
			})
		}
	}, [isShareRoute, allowDownloadProjectFile])

	/**
	 * 过滤批量下载菜单项
	 * - 非分享页面：返回 undefined，不进行过滤
	 * - 无下载权限：返回空数组，禁用批量下载
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

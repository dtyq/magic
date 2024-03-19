import { useMemo } from "react"
import useShareRoute from "@/opensource/pages/superMagic/hooks/useShareRoute"

interface UseShareButtonVisibilityProps {
	/** 是否允许下载（分享页面权限） */
	allowDownload?: boolean
	/** 是否是媒体场景（音频/视频） */
	isMediaScenario?: boolean
	/** 是否是移动端 */
	isMobile?: boolean
	/** 是否允许编辑 */
	allowEdit?: boolean
	/** 是否处于编辑模式 */
	isEditMode?: boolean
}

/**
 * 分享页面按钮可见性控制 Hook
 * 用于统一管理文件详情页中下载/导出按钮的显示逻辑
 */
function useShareButtonVisibility({
	allowDownload,
	isMediaScenario = false,
	isMobile = false,
	allowEdit = true,
	isEditMode = false,
}: UseShareButtonVisibilityProps) {
	const { isShareRoute } = useShareRoute()

	/**
	 * 检查是否应该隐藏按钮（基于分享权限）
	 * - 在分享页面且无下载权限时返回 true
	 * - 其他情况返回 false
	 */
	const shouldHideByPermission = useMemo(() => {
		return isShareRoute && allowDownload === false
	}, [isShareRoute, allowDownload])

	/**
	 * 下载按钮是否应该显示
	 * 综合考虑：媒体场景、分享权限、移动端、编辑权限
	 */
	const showDownloadButton = useMemo(() => {
		// 媒体场景隐藏下载按钮
		if (isMediaScenario) return false

		// 分享页面权限检查
		if (shouldHideByPermission) return false

		// 移动端或无编辑权限时显示
		return isMobile || !allowEdit
	}, [isMediaScenario, shouldHideByPermission, isMobile, allowEdit])

	/**
	 * 导出按钮是否应该显示
	 * 综合考虑：媒体场景、分享权限、编辑模式
	 */
	const showExportButton = useMemo(() => {
		// 媒体场景隐藏导出按钮
		if (isMediaScenario) return false

		// 分享页面权限检查
		if (shouldHideByPermission) return false

		// 非编辑模式时显示
		return !isEditMode
	}, [isMediaScenario, shouldHideByPermission, isEditMode])

	return {
		showDownloadButton,
		showExportButton,
		shouldHideByPermission,
	}
}

export default useShareButtonVisibility

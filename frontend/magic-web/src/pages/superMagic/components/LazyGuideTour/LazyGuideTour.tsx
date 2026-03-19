import { useState, useEffect, useCallback } from "react"
import { Tour } from "antd"
import { useUserInfo } from "@/models/user/hooks"
import { markGuideTourCompleted } from "./GuideTourManager"
import { getWorkspaceGuideTourSteps, getProjectGuideTourSteps } from "./GuideTourSteps"
import { useTranslation } from "react-i18next"

interface LazyGuideTourProps {
	guideType: "workspace" | "project" | null
	workspaceGuideTourElementReady: Record<string, boolean>
	projectGuideTourElementReady: Record<string, boolean>
	guideTourElementRefreshCount: number
}

/**
 * 懒加载的引导教程组件
 * 只有在真正需要显示引导时才会初始化相关逻辑
 */
function LazyGuideTour({
	guideType,
	workspaceGuideTourElementReady,
	projectGuideTourElementReady,
	guideTourElementRefreshCount,
}: LazyGuideTourProps) {
	const { t } = useTranslation("super/guideTour")

	const { userInfo } = useUserInfo()

	const [guideTourOpen, setGuideTourOpen] = useState(false)

	// 检查是否所有必需元素都已准备好
	useEffect(() => {
		if (
			userInfo?.nickname &&
			((guideType === "workspace" &&
				Object.values(workspaceGuideTourElementReady).every((ready) => ready)) ||
				(guideType === "project" &&
					Object.values(projectGuideTourElementReady).every((ready) => ready)))
		) {
			setGuideTourOpen(true)
		}
	}, [
		workspaceGuideTourElementReady,
		projectGuideTourElementReady,
		guideType,
		guideTourElementRefreshCount,
		userInfo?.nickname,
	])

	const handleClose = useCallback(() => {
		if (guideType === "workspace" || guideType === "project") {
			markGuideTourCompleted(userInfo?.magic_id, guideType)
		}
		setGuideTourOpen(false)
	}, [guideType, userInfo?.magic_id])

	// 根据引导类型获取步骤
	const getGuideTourSteps = () => {
		if (guideType === "workspace") {
			return getWorkspaceGuideTourSteps(t)
		} else if (guideType === "project") {
			return getProjectGuideTourSteps(t)
		}
		return []
	}

	// 如果不需要显示引导，返回 null
	if (!guideTourOpen || !guideType) {
		return null
	}

	return (
		<Tour
			steps={getGuideTourSteps()}
			open={guideTourOpen}
			onClose={handleClose}
			gap={{
				radius: 8,
			}}
		/>
	)
}

export default LazyGuideTour

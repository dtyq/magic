import { memo } from "react"
import { useResponsive } from "ahooks"
import ShareManagementModal from "./ShareManagementModal"
import MobileShareManagement from "./MobileShareManagement"
import { SharedResourceType } from "./types"

interface ShareManagementProps {
	open: boolean
	onClose: () => void
	projectId?: string
	defaultTab?: SharedResourceType
}

export default memo(function ShareManagement(props: ShareManagementProps) {
	const { projectId, open, onClose, defaultTab } = props
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	// 移动端使用原有组件
	if (isMobile) {
		return (
			<MobileShareManagement
				open={open}
				onClose={onClose}
				projectId={projectId}
				defaultTab={defaultTab}
			/>
		)
	}

	// PC 端使用新的 Modal 组件
	return (
		<ShareManagementModal
			open={open}
			onClose={onClose}
			projectId={projectId}
			defaultTab={defaultTab}
		/>
	)
})

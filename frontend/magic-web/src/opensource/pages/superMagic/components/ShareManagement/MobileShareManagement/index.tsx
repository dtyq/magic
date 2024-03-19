import { memo, useState, useEffect, useCallback } from "react"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import MobileTopicShareList from "../MobileTopicShareList"
import MobileFileShareList from "../MobileFileShareList"
import MobileProjectShareList from "../MobileProjectShareList"
import PrimaryTabs from "../components/PrimaryTabs"
import StatusTabs from "../components/StatusTabs"
import { SharedResourceType, SharedTopicFilterStatus } from "../types"
import { shareManagementStore } from "../stores"

interface MobileShareManagementProps {
	open: boolean
	onClose: () => void
	projectId?: string
	defaultTab?: SharedResourceType
}

function MobileShareManagement({
	open,
	onClose,
	projectId: defaultProjectId,
	defaultTab,
}: MobileShareManagementProps) {
	const [activeTab, setActiveTab] = useState<SharedResourceType>(
		defaultTab || SharedResourceType.Project,
	)
	const [filterStatus, setFilterStatus] = useState<SharedTopicFilterStatus>(
		SharedTopicFilterStatus.Active,
	)
	// 局部项目选择状态（受控）
	const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(defaultProjectId)

	// 当 defaultTab 改变时更新 activeTab
	useEffect(() => {
		if (defaultTab) {
			setActiveTab(defaultTab)
		}
	}, [defaultTab])

	// 当 defaultProjectId 改变时同步到局部状态和 store
	useEffect(() => {
		setSelectedProjectId(defaultProjectId)
	}, [defaultProjectId])

	// 处理项目选择变化
	const handleProjectChange = useCallback((projectId: string | undefined) => {
		setSelectedProjectId(projectId)
	}, [])

	// 只在项目和文件tab显示状态筛选
	const showStatusTabs = activeTab !== SharedResourceType.Topic

	return (
		<CommonPopup
			showHeader={false}
			title=""
			popupProps={{
				visible: open,
				onClose,
				onMaskClick: onClose,
				showCloseButton: false,
			}}
		>
			<div className="flex h-[calc(100vh-80px-24px-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))] flex-col gap-3">
				{/* Primary Tabs Header */}
				<div className="h-10 border-b border-border px-0">
					<PrimaryTabs value={activeTab} onChange={setActiveTab} className="flex" />
				</div>

				{/* Status Tabs (二级筛选) - 只在项目和文件tab显示 */}
				{showStatusTabs && (
					<div className="h-9 select-none px-3">
						<StatusTabs
							value={filterStatus}
							onChange={setFilterStatus}
							tabListClassName="w-full"
						/>
					</div>
				)}

				{/* Tab Content */}
				<div className="flex-1 overflow-scroll">
					{activeTab === SharedResourceType.Project && (
						<MobileProjectShareList filterStatus={filterStatus} />
					)}
					{activeTab === SharedResourceType.File && (
						<MobileFileShareList
							onClose={onClose}
							projectId={selectedProjectId}
							filterStatus={filterStatus}
							selectedProjectId={selectedProjectId}
							onProjectChange={handleProjectChange}
						/>
					)}
					{activeTab === SharedResourceType.Topic && (
						<MobileTopicShareList
							onClose={onClose}
							projectId={selectedProjectId}
							filterStatus={filterStatus}
							selectedProjectId={selectedProjectId}
							onProjectChange={handleProjectChange}
						/>
					)}
				</div>
			</div>
		</CommonPopup>
	)
}

export default memo(MobileShareManagement)

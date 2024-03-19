import { memo, useState, useCallback, useEffect, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import { SharedResourceType, SharedTopicFilterStatus } from "./types"
import PrimaryTabs from "./components/PrimaryTabs"
import StatusTabs from "./components/StatusTabs"
import SearchBar from "./components/SearchBar"
import ShareListFooter from "./components/ShareListFooter"
import TopicShareListNew from "./components/TopicShareListNew"
import FileShareListNew from "./components/FileShareListNew"
import { useShareData } from "./hooks/useShareData"
import type { TopicShareItem, FileShareItem } from "./types"
import { getSearchPlaceholder as getSearchPlaceholderHelper } from "./utils/searchPlaceholder"

interface ShareManagementProps {
	open: boolean
	onClose: () => void
	projectId?: string
	defaultTab?: SharedResourceType
}

function ShareManagement({
	open,
	onClose,
	projectId: defaultProjectId,
	defaultTab,
}: ShareManagementProps) {
	const { t } = useTranslation("super")

	// 状态管理
	const [activeTab, setActiveTab] = useState<SharedResourceType>(
		defaultTab || SharedResourceType.Project,
	)
	const [filterStatus, setFilterStatus] = useState<SharedTopicFilterStatus>(
		SharedTopicFilterStatus.Active,
	)
	const [searchText, setSearchText] = useState("")
	const [currentPage, setCurrentPage] = useState(1)
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

	// 当 selectedProjectId 变化时，重置页码并触发数据重新加载
	useEffect(() => {
		if (activeTab !== SharedResourceType.Project) {
			setCurrentPage(1)
		}
	}, [selectedProjectId, activeTab])

	// 切换一级Tab时重置状态
	const handleTabChange = useCallback((tab: SharedResourceType) => {
		setActiveTab(tab)
		setFilterStatus(SharedTopicFilterStatus.Active)
		setSearchText("")
		setCurrentPage(1)
	}, [])

	// 切换二级Tab
	const handleStatusChange = useCallback((status: SharedTopicFilterStatus) => {
		setFilterStatus(status)
		setCurrentPage(1)
	}, [])

	// 搜索栏变化
	const handleSearchChange = useCallback((value: string) => {
		setSearchText(value)
		setCurrentPage(1)
	}, [])

	// 处理项目选择变化
	const handleProjectChange = useCallback((projectId: string | undefined) => {
		setSelectedProjectId(projectId)
	}, [])

	// 获取搜索框placeholder
	const getSearchPlaceholder = useCallback(() => {
		return getSearchPlaceholderHelper(activeTab, t)
	}, [activeTab, t])

	// 是否显示二级状态Tab（仅项目和文件分享需要）
	const showStatusTabs =
		activeTab === SharedResourceType.Project || activeTab === SharedResourceType.File

	// 使用数据Hook
	// 当切换到项目tab时，projectId应该为undefined，因为项目分享列表应该显示所有项目的分享
	const { data, total, loading, refreshData, cancelShare } = useShareData({
		resourceType: activeTab,
		filterStatus,
		searchText,
		projectId: activeTab === SharedResourceType.Project ? undefined : selectedProjectId,
		currentPage,
		pageSize: 10,
	})

	// 计算总页数
	const totalPages = useMemo(() => Math.ceil(total / 10), [total])

	// 处理页码变化
	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page)
	}, [])

	// 渲染列表内容
	const renderListContent = useCallback(() => {
		switch (activeTab) {
			case SharedResourceType.Topic:
				return (
					<TopicShareListNew
						data={data as TopicShareItem[]}
						loading={loading}
						onCancelShare={cancelShare}
						onRefresh={refreshData}
					/>
				)
			case SharedResourceType.File:
				return (
					<FileShareListNew
						data={data as FileShareItem[]}
						loading={loading}
						onCancelShare={cancelShare}
						onRefresh={refreshData}
					/>
				)
			case SharedResourceType.Project:
				return (
					<FileShareListNew
						data={data as FileShareItem[]}
						loading={loading}
						onCancelShare={cancelShare}
						onRefresh={refreshData}
					/>
				)
			default:
				return null
		}
	}, [activeTab, data, loading, cancelShare, refreshData])

	return (
		<MagicModal
			title={<PrimaryTabs value={activeTab} onChange={handleTabChange} />}
			open={open}
			onCancel={onClose}
			width={700}
			footer={null}
			centered
			zIndex={1200}
			classNames={{
				header: "!pb-0 !pt-2 !px-3",
				body: "!p-0",
			}}
			maskClosable={false}
		>
			<div className="flex h-full flex-col" style={{ height: "512px" }}>
				{/* 顶部搜索区域 */}
				<div className="flex flex-col gap-3 px-3 pb-3 pt-5">
					{showStatusTabs && (
						<StatusTabs value={filterStatus} onChange={handleStatusChange} />
					)}

					<SearchBar
						value={searchText}
						onChange={handleSearchChange}
						placeholder={getSearchPlaceholder()}
						resourceType={activeTab}
						selectedProjectId={selectedProjectId}
						onProjectChange={handleProjectChange}
						showFilterLabel={true}
					/>
				</div>

				{/* 列表内容区域 - 固定高度，可滚动 */}
				<div className="flex-1 overflow-y-auto px-3" style={{ maxHeight: "388px" }}>
					{renderListContent()}
				</div>

				{/* 底部分页器 - 固定在底部 */}
				<div className="mt-auto">
					<ShareListFooter
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={handlePageChange}
					/>
				</div>
			</div>
		</MagicModal>
	)
}

export default memo(observer(ShareManagement))

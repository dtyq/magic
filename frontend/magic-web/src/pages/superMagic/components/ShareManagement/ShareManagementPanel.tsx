import { memo, useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce } from "ahooks"
import { Funnel, Search } from "lucide-react"
import { SharedResourceType, SharedTopicFilterStatus, ShareListRefreshType } from "./types"
import MobileProjectShareList from "./MobileProjectShareList"
import MobileFileShareList from "./MobileFileShareList"
import MobileTopicShareList from "./MobileTopicShareList"
import ShareManagementTabs from "./components/ShareManagementTabs"
import { getSearchPlaceholder } from "./utils/searchPlaceholder"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/shadcn-ui/select"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn-ui/input-group"
import { cn } from "@/utils/cn"
import {
	PROJECT_PANEL_HEADER_CLASSNAME,
	PROJECT_PANEL_TITLE_CLASSNAME,
} from "../ProjectSider/panelChrome"

interface ShareManagementPanelProps {
	projectId?: string
	className?: string
}

function ShareManagementPanel({ projectId, className }: ShareManagementPanelProps) {
	const { t } = useTranslation("super")
	const [activeTab, setActiveTab] = useState<SharedResourceType>(SharedResourceType.File)
	const [filterStatus, setFilterStatus] = useState<SharedTopicFilterStatus>(
		SharedTopicFilterStatus.Active,
	)
	const [searchText, setSearchText] = useState("")
	const debouncedSearchText = useDebounce(searchText, { wait: 300 })

	const [projectRefreshTrigger, setProjectRefreshTrigger] = useState(0)
	const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)
	const [topicRefreshTrigger, setTopicRefreshTrigger] = useState(0)

	const handleTabChange = useCallback((tab: SharedResourceType) => {
		setActiveTab(tab)
		setFilterStatus(SharedTopicFilterStatus.Active)
		setSearchText("")
	}, [])

	const handleStatusChange = useCallback((status: SharedTopicFilterStatus) => {
		setFilterStatus(status)
	}, [])

	const handleSearchChange = useCallback((value: string) => {
		setSearchText(value)
	}, [])

	useEffect(() => {
		const handleRefreshShareList = (type: ShareListRefreshType) => {
			switch (type) {
				case ShareListRefreshType.Project:
					setProjectRefreshTrigger((prev) => prev + 1)
					break
				case ShareListRefreshType.File:
					setFileRefreshTrigger((prev) => prev + 1)
					break
				case ShareListRefreshType.Topic:
					setTopicRefreshTrigger((prev) => prev + 1)
					break
			}
		}

		pubsub.subscribe(PubSubEvents.Refresh_Share_List, handleRefreshShareList)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Refresh_Share_List, handleRefreshShareList)
		}
	}, [])

	const showStatusFilter =
		activeTab === SharedResourceType.Project || activeTab === SharedResourceType.File

	const searchPlaceholder = getSearchPlaceholder(activeTab, t)

	return (
		<div className={cn("flex h-full flex-col gap-0.5", className)}>
			{/* Header */}
			<div className={PROJECT_PANEL_HEADER_CLASSNAME} data-slot="project-panel-header">
				<span className={PROJECT_PANEL_TITLE_CLASSNAME} data-slot="project-panel-title">
					{t("shareManagement.title")}
				</span>
				<div data-slot="project-panel-tabs">
					<ShareManagementTabs value={activeTab} onChange={handleTabChange} />
				</div>
			</div>

			{/* Filter */}
			<div
				className="flex h-9 items-center gap-1 px-2 py-1.5"
				data-slot="project-panel-toolbar"
			>
				{showStatusFilter && (
					<Select
						value={filterStatus}
						onValueChange={(val) => handleStatusChange(val as SharedTopicFilterStatus)}
					>
						<SelectTrigger
							className="!h-7 !w-7 justify-center gap-0 p-0 text-foreground hover:bg-accent [&>svg:last-child]:hidden"
							aria-label={t("shareManagement.filter")}
							title={t("shareManagement.filter")}
						>
							<Funnel height={16} width={16} strokeWidth={1.75} />
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value={SharedTopicFilterStatus.Active}>
								{t("shareManagement.filterStatus.active")}
							</SelectItem>
							<SelectItem value={SharedTopicFilterStatus.Expired}>
								{t("shareManagement.filterStatus.expired")}
							</SelectItem>
							<SelectItem value={SharedTopicFilterStatus.Cancelled}>
								{t("shareManagement.filterStatus.cancelled")}
							</SelectItem>
						</SelectContent>
					</Select>
				)}
				<InputGroup className="!hover:bg-accent h-7 flex-1 !bg-transparent text-foreground">
					<InputGroupAddon align="inline-start">
						<Search size={16} />
					</InputGroupAddon>
					<InputGroupInput
						value={searchText}
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder={searchPlaceholder}
					/>
				</InputGroup>
			</div>

			{/* Content */}
			<div
				className="flex-1 overflow-hidden"
				data-layout="share-management-content"
				data-slot="project-panel-content"
			>
				{activeTab === SharedResourceType.Project && (
					<MobileProjectShareList
						key={`project-${projectRefreshTrigger}`}
						projectId={projectId}
						filterStatus={filterStatus}
						hideSearchBar={true}
						searchText={debouncedSearchText}
						disableProjectNavigation={true}
						showProjectBadge={false}
					/>
				)}
				{activeTab === SharedResourceType.File && (
					<MobileFileShareList
						key={`file-${fileRefreshTrigger}`}
						projectId={projectId}
						filterStatus={filterStatus}
						hideSearchBar={true}
						searchText={debouncedSearchText}
						disableProjectNavigation={true}
						showProjectBadge={false}
					/>
				)}
				{activeTab === SharedResourceType.Topic && (
					<MobileTopicShareList
						key={`topic-${topicRefreshTrigger}`}
						projectId={projectId}
						filterStatus={filterStatus}
						hideSearchBar={true}
						searchText={debouncedSearchText}
						disableProjectNavigation={true}
						showProjectBadge={false}
					/>
				)}
			</div>
		</div>
	)
}

export default memo(ShareManagementPanel)

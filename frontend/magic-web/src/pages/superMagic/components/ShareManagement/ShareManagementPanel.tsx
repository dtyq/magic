import { memo, useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce } from "ahooks"
import { Search } from "lucide-react"
import { SharedResourceType, SharedTopicFilterStatus, ShareListRefreshType } from "./types"
import MobileProjectShareList from "./MobileProjectShareList"
import MobileFileShareList from "./MobileFileShareList"
import MobileTopicShareList from "./MobileTopicShareList"
import ShareManagementTabs from "./components/ShareManagementTabs"
import { getSearchPlaceholder } from "./utils/searchPlaceholder"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/shadcn-ui/input-group"

interface ShareManagementPanelProps {
	projectId?: string
}

function ShareManagementPanel({ projectId }: ShareManagementPanelProps) {
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
		<div className="flex h-full flex-col gap-0.5">
			{/* Header */}
			<div className="flex items-center justify-between px-2">
				<span className="text-sm font-semibold leading-[1.333] text-foreground">
					{t("shareManagement.title")}
				</span>
				<ShareManagementTabs value={activeTab} onChange={handleTabChange} />
			</div>

			{/* Filter */}
			<div className="flex h-9 items-center gap-1 px-2 py-1.5">
				{showStatusFilter && (
					<Select
						value={filterStatus}
						onValueChange={(val) => handleStatusChange(val as SharedTopicFilterStatus)}
					>
						<SelectTrigger className="!h-7 w-[90px] border-input bg-transparent text-foreground hover:bg-accent">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
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
			<div className="flex-1 overflow-hidden">
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

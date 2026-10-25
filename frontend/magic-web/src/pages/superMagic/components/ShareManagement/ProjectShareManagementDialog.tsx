import { memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import FileShareManagementListCore from "./components/FileShareManagementListCore"
import ShareListFooter from "./components/ShareListFooter"
import { SharedResourceType, SharedTopicFilterStatus } from "./types"

export interface ProjectShareManagementDialogProps {
	open: boolean
	projectId: string
	onClose: () => void
}

type ProjectShareTab = SharedResourceType.Project | SharedResourceType.File

const PAGE_SIZE = 10

/** Status choices supported by the share-management list API. */
const STATUS_OPTIONS = [
	SharedTopicFilterStatus.Active,
	SharedTopicFilterStatus.Expired,
	SharedTopicFilterStatus.Cancelled,
]

/**
 * Share manager scoped to one project, laid out like the recording share manager: the shares of
 * the project itself and of its files, filtered by status. The global share manager (all
 * projects, topic shares, search) stays unchanged.
 */
function ProjectShareManagementDialog({
	open,
	projectId,
	onClose,
}: ProjectShareManagementDialogProps) {
	const { t } = useTranslation("super")
	const [activeTab, setActiveTab] = useState<ProjectShareTab>(SharedResourceType.Project)
	const [filterStatus, setFilterStatus] = useState<SharedTopicFilterStatus>(
		SharedTopicFilterStatus.Active,
	)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(0)

	useEffect(() => {
		// Each opening starts from the project's active shares.
		if (!open) return
		setActiveTab(SharedResourceType.Project)
		setFilterStatus(SharedTopicFilterStatus.Active)
		setCurrentPage(1)
	}, [open, projectId])

	const tabs = useMemo(
		() => [
			{
				value: SharedResourceType.Project as ProjectShareTab,
				label: t("shareManagement.projectShare"),
			},
			{
				value: SharedResourceType.File as ProjectShareTab,
				label: t("shareManagement.fileShare"),
			},
		],
		[t],
	)

	/** Switching lists or filters returns pagination to the first page. */
	function handleTabChange(value: ProjectShareTab) {
		setActiveTab(value)
		setCurrentPage(1)
	}

	function handleStatusChange(value: string) {
		setFilterStatus(value as SharedTopicFilterStatus)
		setCurrentPage(1)
	}

	/** Keeps footer pagination aligned with the list response total. */
	function handleTotalPagesChange(nextTotalPages: number) {
		setTotalPages(nextTotalPages)
		if (nextTotalPages > 0 && currentPage > nextTotalPages) {
			setCurrentPage(nextTotalPages)
		}
	}

	/** Literal i18n keys per status so static extraction stays reliable. */
	function getStatusLabel(status: SharedTopicFilterStatus) {
		switch (status) {
			case SharedTopicFilterStatus.Expired:
				return t("shareManagement.filterStatus.expired")
			case SharedTopicFilterStatus.Cancelled:
				return t("shareManagement.filterStatus.cancelled")
			case SharedTopicFilterStatus.Active:
			default:
				return t("shareManagement.filterStatus.active")
		}
	}

	return (
		<MagicModal
			title={t("project.manageShare")}
			open={open}
			onCancel={onClose}
			width={700}
			footer={null}
			centered
			zIndex={1200}
			classNames={{
				header: "!px-4 !py-4",
				body: "!p-0",
			}}
			maskClosable={false}
		>
			<div className="flex h-[512px] flex-col" data-testid="project-share-management-dialog">
				<div className="flex items-center justify-between gap-3 px-3 pb-3 pt-5">
					<SmoothTabs<ProjectShareTab>
						tabs={tabs}
						value={activeTab}
						onChange={handleTabChange}
						className="h-9"
						data-testid="project-share-management-tabs"
					/>
					<div className="flex flex-shrink-0 items-center gap-2">
						<span className="text-sm font-medium leading-none text-foreground">
							{t("shareManagement.statusFilter")}
						</span>
						<Select value={filterStatus} onValueChange={handleStatusChange}>
							<SelectTrigger
								className="w-[140px] text-left"
								data-testid="project-share-management-status-select"
							>
								<SelectValue />
							</SelectTrigger>
							{/* Above the dialog (z-index 1200). */}
							<SelectContent align="start" style={{ zIndex: 1300 }}>
								{STATUS_OPTIONS.map((status) => (
									<SelectItem key={status} value={status}>
										{getStatusLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* A full-height wrapper preserves the shared list's centered loading and empty states. */}
				<ScrollArea
					className="grid max-h-[388px] min-h-0 flex-1"
					viewportClassName="h-auto min-h-0 px-3 [&>div]:!block [&>div]:h-full"
				>
					<FileShareManagementListCore
						key={activeTab}
						projectId={projectId}
						resourceType={activeTab}
						filterStatus={filterStatus}
						currentPage={currentPage}
						pageSize={PAGE_SIZE}
						onTotalPagesChange={handleTotalPagesChange}
					/>
				</ScrollArea>

				<div className="mt-auto">
					<ShareListFooter
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={setCurrentPage}
					/>
				</div>
			</div>
		</MagicModal>
	)
}

export default memo(ProjectShareManagementDialog)

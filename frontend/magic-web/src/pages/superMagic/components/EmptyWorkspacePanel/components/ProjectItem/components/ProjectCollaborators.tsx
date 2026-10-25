import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import MagicAvatar from "@/components/base/MagicAvatar"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/utils/cn"
import type {
	CollaborationProjectListItem,
	ProjectListItem,
} from "@/pages/superMagic/pages/Workspace/types"
import AddCollaborators from "./AddCollaborators"

interface ProjectCollaboratorsProps<T extends ProjectListItem> {
	project: T
	compact: boolean
	list: boolean
	showCreator: boolean
	selfShared: boolean
	onAddCollaborators?: (project: T) => void
	copyLinkButton?: ReactNode
}

/** 人员展示共用真实项目数据；项目动作和权限仍由原来的项目条目及成员入口负责。 */
function ProjectCollaborators<T extends ProjectListItem>({
	project,
	compact,
	list,
	showCreator,
	selfShared,
	onAddCollaborators,
	copyLinkButton,
}: ProjectCollaboratorsProps<T>) {
	const { t } = useTranslation("super")
	const shareItem = project as T & CollaborationProjectListItem
	const creatorName = shareItem.creator?.nickname || (list ? t("common.unknown") : undefined)
	const members = shareItem.members || []
	const memberCount = shareItem.member_count ?? members.length

	return (
		<div
			className={cn(
				"flex flex-row items-start justify-between gap-2 border-t border-border pt-2.5",
				compact && "col-span-3 row-start-2 items-center pt-2",
				list &&
					"row-start-3 flex-wrap justify-start gap-x-5 border-t-0 pt-1 [@container_(min-width:800px)]:contents",
			)}
			data-testid="project-item-collaborators"
		>
			{showCreator && (
				<div
					className={cn(
						"flex w-full flex-col justify-center gap-1.5",
						list &&
							"w-auto min-w-0 max-w-full flex-row items-center [@container_(min-width:800px)]:col-start-[creator] [@container_(min-width:800px)]:row-start-1 [@container_(min-width:800px)]:w-full",
					)}
					style={list ? undefined : { maxWidth: "calc(100% - 90px)" }}
					data-testid="project-item-creator-section"
				>
					<div
						className={cn(
							"text-[10px] font-normal leading-[13px] text-muted-foreground empty:block",
							list && "shrink-0 text-xs [@container_(min-width:800px)]:sr-only",
						)}
						data-testid="project-item-creator-label"
					>
						{t("collaborators.creator")}
					</div>
					<div className="flex w-full min-w-0 items-center gap-1">
						<MagicAvatar
							src={shareItem.creator?.avatar_url || undefined}
							size={20}
							shape="circle"
						>
							{creatorName}
						</MagicAvatar>
						<SmartTooltip
							className={cn(
								"flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-foreground",
								list ? "min-w-0" : "shrink-0",
							)}
						>
							{creatorName}
						</SmartTooltip>
					</div>
				</div>
			)}
			<div
				className={cn(
					"flex shrink-0 flex-col justify-center gap-1.5",
					list &&
						"flex-row items-center justify-start [@container_(min-width:800px)]:col-start-[members] [@container_(min-width:800px)]:row-start-1",
				)}
				style={list ? undefined : { maxWidth: 80 }}
				data-testid="project-item-members-section"
			>
				<div
					className={cn(
						"text-[10px] font-normal leading-[13px] text-muted-foreground empty:block",
						list && "shrink-0 text-xs [@container_(min-width:800px)]:sr-only",
					)}
					data-testid="project-item-members-label"
				>
					{t("collaborators.collaborator")}
				</div>
				<AddCollaborators<T>
					members={members}
					totalCount={memberCount}
					max={list ? 3 : undefined}
					isSelfCollaborationProjectStatus={selfShared}
					selectedProject={project}
					onAddCollaborators={onAddCollaborators}
				/>
				{list && memberCount === 0 && members.length === 0 && (
					<span className="whitespace-nowrap text-xs text-muted-foreground">
						{t("collaborators.empty")}
					</span>
				)}
			</div>
			{copyLinkButton}
		</div>
	)
}

export default observer(ProjectCollaborators)

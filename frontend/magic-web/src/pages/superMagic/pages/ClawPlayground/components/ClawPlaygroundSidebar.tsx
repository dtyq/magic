import type { MagicClawItem } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { Skills } from "@/enhance/lucide-react"
import IconShareCog from "@/enhance/tabler/icons-react/icons/iconShareCog"
import ShareManagementPanel from "@/pages/superMagic/components/ShareManagement/ShareManagementPanel"
import TopicFilesButton, {
	type TopicFileRowDecorationResolver,
	type TopicFilesButtonProps,
} from "@/pages/superMagic/components/TopicFilesButton"
import { ArrowLeft, ChevronRight, Files, Timer } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ClawScheduledTaskPanel } from "./ClawScheduledTaskPanel"
import { ClawPlaygroundProjectCard } from "./ClawPlaygroundProjectCard"

const CLAW_PLAYGROUND_SIDEBAR_TAB = {
	Files: "files",
	ScheduledTask: "scheduled-task",
	Share: "share",
} as const

export interface ClawPlaygroundSidebarProps {
	magicClaw: MagicClawItem | null
	sandboxLatestVersion?: string | null
	isUpdatingSandbox?: boolean
	selectedProjectId: string | null
	isReadOnly: boolean
	topicFilesProps: TopicFilesButtonProps
	resolveTopicFileRowDecoration: TopicFileRowDecorationResolver
	onBack: () => void
	onOpenEditDialog: () => void
	onUpgradeSandbox: () => void
	onOpenSkillsPanel: () => void
}

export function ClawPlaygroundSidebar({
	magicClaw,
	sandboxLatestVersion,
	isUpdatingSandbox,
	selectedProjectId,
	isReadOnly,
	topicFilesProps,
	resolveTopicFileRowDecoration,
	onBack,
	onOpenEditDialog,
	onUpgradeSandbox,
	onOpenSkillsPanel,
}: ClawPlaygroundSidebarProps) {
	const { t } = useTranslation("sidebar")
	const { t: tSuper } = useTranslation("super")
	const [sidebarTab, setSidebarTab] = useState<
		(typeof CLAW_PLAYGROUND_SIDEBAR_TAB)[keyof typeof CLAW_PLAYGROUND_SIDEBAR_TAB]
	>(CLAW_PLAYGROUND_SIDEBAR_TAB.Files)
	const isScheduledTaskVisible = !isReadOnly
	const activeSidebarTab = isScheduledTaskVisible ? sidebarTab : CLAW_PLAYGROUND_SIDEBAR_TAB.Files

	// 转换为 SmoothTabs 需要的格式
	const tabs = useMemo(() => {
		const baseTabs: Array<{
			value: (typeof CLAW_PLAYGROUND_SIDEBAR_TAB)[keyof typeof CLAW_PLAYGROUND_SIDEBAR_TAB]
			label: string
			icon: React.ReactNode
			tooltip: string
		}> = [
			{
				value: CLAW_PLAYGROUND_SIDEBAR_TAB.Files,
				label: "",
				icon: <Files className="size-4" />,
				tooltip: tSuper("topicFiles.fileTitle"),
			},
			{
				value: CLAW_PLAYGROUND_SIDEBAR_TAB.Share,
				label: "",
				icon: <IconShareCog className="size-4" size={16} color="currentColor" />,
				tooltip: tSuper("shareManagement.title"),
			},
		]

		if (isScheduledTaskVisible) {
			baseTabs.splice(1, 0, {
				value: CLAW_PLAYGROUND_SIDEBAR_TAB.ScheduledTask,
				label: "",
				icon: <Timer className="size-4" />,
				tooltip: tSuper("scheduleTask.title"),
			})
		}

		return baseTabs
	}, [isScheduledTaskVisible, tSuper])

	return (
		<div className="flex h-full flex-col gap-1" data-testid="claw-playground-sidebar">
			<div className="flex shrink-0 items-center gap-1">
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-10 rounded-[10px] bg-background shadow-xs"
					data-testid="claw-playground-back-button"
					onClick={onBack}
				>
					<ArrowLeft className="size-4" />
				</Button>

				<ClawPlaygroundProjectCard
					magicClaw={magicClaw}
					sandboxLatestVersion={sandboxLatestVersion}
					isUpdatingSandbox={isUpdatingSandbox}
					onOpenEditDialog={onOpenEditDialog}
					onUpgradeSandbox={onUpgradeSandbox}
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background p-2">
				<div
					className="flex h-full flex-col gap-2"
					data-testid="claw-playground-sidebar-tabs"
				>
					{/* Header - 横向 Tabs */}
					<div className="flex-shrink-0" data-testid="claw-playground-sidebar-tabs-list">
						<SmoothTabs
							tabs={tabs}
							value={activeSidebarTab}
							onChange={(value) =>
								setSidebarTab(
									value as (typeof CLAW_PLAYGROUND_SIDEBAR_TAB)[keyof typeof CLAW_PLAYGROUND_SIDEBAR_TAB],
								)
							}
							variant="background"
							className="h-9 w-full bg-muted p-[3px]"
							buttonClassName="py-0 h-[28px]"
							indicatorClassName="h-[28px] inset-y-[3px]"
						/>
					</div>

					{/* Content */}
					<div
						className="min-h-0 flex-1 overflow-hidden"
						data-testid="claw-playground-sidebar-tab-content"
					>
						<div
							className={`h-full overflow-hidden ${
								activeSidebarTab === CLAW_PLAYGROUND_SIDEBAR_TAB.Files
									? "block"
									: "hidden"
							}`}
							data-testid="claw-playground-files-tree"
							aria-hidden={activeSidebarTab !== CLAW_PLAYGROUND_SIDEBAR_TAB.Files}
						>
							<TopicFilesButton
								{...topicFilesProps}
								className="h-full"
								title={tSuper("topicFiles.fileTitle")}
								resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
							/>
						</div>

						<div
							className={`h-full overflow-hidden ${
								activeSidebarTab === CLAW_PLAYGROUND_SIDEBAR_TAB.Share
									? "block"
									: "hidden"
							}`}
							data-testid="claw-playground-share-panel"
							aria-hidden={activeSidebarTab !== CLAW_PLAYGROUND_SIDEBAR_TAB.Share}
						>
							<ShareManagementPanel projectId={selectedProjectId ?? undefined} />
						</div>
						<div
							className={`h-full overflow-hidden ${
								activeSidebarTab === CLAW_PLAYGROUND_SIDEBAR_TAB.ScheduledTask
									? "block"
									: "hidden"
							}`}
							data-testid="claw-playground-scheduled-task-panel"
							aria-hidden={
								activeSidebarTab !== CLAW_PLAYGROUND_SIDEBAR_TAB.ScheduledTask
							}
						>
							<ClawScheduledTaskPanel
								projectId={selectedProjectId}
								agentCode={magicClaw?.code}
								isActive={
									activeSidebarTab === CLAW_PLAYGROUND_SIDEBAR_TAB.ScheduledTask
								}
							/>
						</div>
					</div>
				</div>
			</div>

			<button
				type="button"
				className="flex w-full shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-left shadow-xs transition-colors hover:bg-muted/60"
				data-testid="claw-playground-skills-library-entry"
				onClick={onOpenSkillsPanel}
			>
				<Skills className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
					{t("skillsLibrary.title")}
				</span>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
			</button>
		</div>
	)
}

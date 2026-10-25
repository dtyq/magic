import type { ReactNode } from "react"
import { Bot, Box, Clock3, LayoutGrid, UsersRound, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagiClaw } from "@/enhance/lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { SidebarRow } from "../../../SidebarSection"
import type { Workspace } from "../../../../pages/Workspace/types"
import {
	MY_AGENTS_WORKSPACE_ID,
	MY_CLAW_WORKSPACE_ID,
	MY_SKILLS_WORKSPACE_ID,
	SHARE_WORKSPACE_ID,
} from "../../../../constants"

export function MentionSourceSidebar({
	workspaces,
	specialWorkspaces,
	current,
	recentActive,
	onSelectRecent,
	onSelect,
	footer,
}: {
	workspaces: Workspace[]
	specialWorkspaces: Workspace[]
	current: Workspace | null
	recentActive: boolean
	onSelectRecent: () => void
	footer?: ReactNode
	onSelect: (workspace: Workspace) => void
}) {
	const { t } = useTranslation("super")
	const row = (workspace: Workspace) => {
		const Icon =
			workspace.workspace_type === "micro-app"
				? LayoutGrid
				: workspace.id === SHARE_WORKSPACE_ID
					? UsersRound
					: workspace.id === MY_CLAW_WORKSPACE_ID
						? MagiClaw
						: workspace.id === MY_SKILLS_WORKSPACE_ID
							? Wrench
							: workspace.id === MY_AGENTS_WORKSPACE_ID
								? Bot
								: Box
		return (
			<SidebarRow
				key={workspace.id}
				label={workspace.name || t("workspace.unnamedWorkspace")}
				labelVariant="navigation"
				labelClassName="flex-1 text-xs [&>span]:block [&>span]:truncate"
				leading={<Icon size={16} />}
				hideChevron
				testId={`picker-source-${workspace.id}`}
				isActive={
					!recentActive &&
					(current?.id === workspace.id ||
						(workspace.workspace_type === "micro-app" &&
							current?.workspace_type === "micro-app"))
				}
				onClick={() => onSelect(workspace)}
			/>
		)
	}
	return (
		<nav
			aria-label={t("selectPathModal.workspace")}
			className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-muted/20 p-2"
		>
			<SidebarRow
				label={t("projectNavigation.recent")}
				labelVariant="navigation"
				labelClassName="text-xs"
				leading={<Clock3 size={16} />}
				hideChevron
				testId="picker-source-recent"
				isActive={recentActive}
				onClick={onSelectRecent}
			/>
			<div className="shrink-0 px-2 py-2 text-xs font-medium text-muted-foreground">
				{t("selectPathModal.workspace")}
			</div>
			{/* 滚动区铺满剩余高度；半行提示只适用于项目列表，不能在固定入口上方制造空白。 */}
			<div className="min-h-0 min-w-0 flex-1">
				<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
					<div className="pb-2">
						{workspaces.map(row)}
						{footer}
					</div>
				</ScrollArea>
			</div>
			<div className="mt-2 shrink-0 border-t pt-2">{specialWorkspaces.map(row)}</div>
		</nav>
	)
}

import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sidebarStore } from "@/opensource/stores/layout"
import workspaceStore from "@/opensource/pages/superMagic/stores/core/workspace"
import WorkspaceItem from "./WorkspaceItem"
import CreateWorkspaceInput from "./CreateWorkspaceInput"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { cn } from "@/opensource/lib/utils"
import { toTestIdSegment } from "@/opensource/utils/testid"
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
} from "@/opensource/components/shadcn-ui/sidebar"

function WorkspaceList() {
	const { t } = useTranslation()
	const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
	const workspaces = workspaceStore.workspaces
	const selectedWorkspaceId = workspaceStore.selectedWorkspace?.id
	const workspaceListRef = useRef<HTMLDivElement>(null)

	function handleStartCreateWorkspace() {
		setIsCreatingWorkspace(true)
	}

	function handleCancelCreateWorkspace() {
		setIsCreatingWorkspace(false)
	}

	function handleWorkspaceCreated() {
		setIsCreatingWorkspace(false)
	}

	useEffect(() => {
		if (!selectedWorkspaceId) return

		sidebarStore.setActiveWorkspace(selectedWorkspaceId)
		sidebarStore.setWorkspaceExpanded(selectedWorkspaceId, true)

		const workspaceIdSegment = toTestIdSegment(selectedWorkspaceId)
		const animationFrameId = window.requestAnimationFrame(() => {
			const workspaceElement = workspaceListRef.current?.querySelector<HTMLElement>(
				`[data-workspace-id-segment="${workspaceIdSegment}"]`,
			)
			workspaceElement?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			})
		})

		return () => window.cancelAnimationFrame(animationFrameId)
	}, [selectedWorkspaceId, workspaces.length])

	return (
		<SidebarGroup
			className="flex min-h-0 w-full flex-1 flex-col py-0 pl-2 pr-0"
			data-testid="sidebar-workspace-list"
		>
			<SidebarGroupLabel className="h-8 px-2 text-xs font-medium leading-4 text-[#737373] opacity-70 dark:text-[#a3a3a3] dark:opacity-100">
				{t("sidebar:workspace.title")}
			</SidebarGroupLabel>
			<SidebarGroupAction
				className="right-3.5 top-1.5 h-5 w-5 opacity-70"
				onClick={handleStartCreateWorkspace}
				aria-label={t("sidebar:workspace.add")}
				data-testid="sidebar-workspace-list-add"
			>
				<Plus className="h-4 w-4" />
			</SidebarGroupAction>
			<SidebarGroupContent className="flex min-h-0 flex-1">
				<SidebarMenu className="h-full min-h-0">
					<ScrollArea
						className={cn(
							"h-full min-h-0 w-full scroll-smooth [&_[data-slot='scroll-area-scrollbar']]:bg-transparent",
							"[&_[data-slot='scroll-area-viewport']>div]:!block",
							"pr-3",
						)}
					>
						<div ref={workspaceListRef}>
							{isCreatingWorkspace && (
								<div className="w-full duration-150 animate-in fade-in slide-in-from-top-2">
									<CreateWorkspaceInput
										onCancel={handleCancelCreateWorkspace}
										onCreated={handleWorkspaceCreated}
									/>
								</div>
							)}
							{workspaces.map((workspace, index) => (
								<WorkspaceItem
									key={workspace.id}
									workspace={workspace}
									className={cn(
										"mb-[2px]",
										index === workspaces.length - 1 && "mb-0",
									)}
								/>
							))}
						</div>
					</ScrollArea>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}

export default observer(WorkspaceList)

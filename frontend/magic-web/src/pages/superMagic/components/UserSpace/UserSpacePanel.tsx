import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Brain, CircleHelp, Files, PanelsTopLeft, ArrowUpRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import { cn } from "@/utils/cn"
import userFilesStore from "@/stores/userFiles"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import type { UserSpaceView } from "../Detail/components/FilesViewer/types"
import {
	PROJECT_PANEL_HEADER_CLASSNAME,
	PROJECT_PANEL_TITLE_CLASSNAME,
} from "../ProjectSider/panelChrome"
import UserSpaceFilesView from "./UserSpaceFilesView"
import { useUserSpaceOverviewHelp } from "./useUserFileHelp"
import { useUserFilesChangeRealtime } from "../../hooks/useUserFilesChangeRealtime"

const UserSpaceMemoryView = lazy(() => import("./UserSpaceMemoryView"))
const FileHelpBrowser = lazy(() => import("../TopicFilesButton/components/FileHelpBrowser"))

export interface UserSpacePanelProps {
	className?: string
	projectId?: string | null
	projectName?: string
	topicId?: string
	activeFileId?: string | null
	onFileClick?: (file: AttachmentItem) => void
}

export default observer(function UserSpacePanel({
	className,
	projectId,
	projectName,
	topicId,
	activeFileId,
	onFileClick,
}: UserSpacePanelProps) {
	const { t } = useTranslation("super")
	const overview = useUserSpaceOverviewHelp()
	const identity = userFilesStore.currentIdentityKey
	const previousIdentity = useRef(identity)
	const [view, setView] = useState<UserSpaceView>("files")
	const [memoryVisited, setMemoryVisited] = useState(false)
	const [directoryId, setDirectoryId] = useState<string>()
	useUserFilesChangeRealtime(Boolean(identity))
	useEffect(() => {
		if (previousIdentity.current === identity) return
		previousIdentity.current = identity
		setDirectoryId(undefined)
		setView("files")
	}, [identity])
	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
			<div className={PROJECT_PANEL_HEADER_CLASSNAME} data-slot="project-panel-header">
				<h2 className={PROJECT_PANEL_TITLE_CLASSNAME} data-slot="project-panel-title">
					{t("userSpace.title")}
				</h2>
				<ContextHelp
					key={identity}
					mode="dialog"
					help={overview.help}
					renderDialog={(props) => (
						<FileHelpBrowser {...props} initialArticleId="user.overview" />
					)}
				>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 shrink-0 gap-1 px-1.5 text-xs text-muted-foreground"
						aria-label={t("userSpace.help.privateLabel")}
					>
						<span>{t("userSpace.help.private")}</span>
						<CircleHelp size={16} />
					</Button>
				</ContextHelp>
			</div>
			<div role="tablist" className="mx-2 flex shrink-0 rounded-md bg-muted p-0.5">
				{(
					[
						{ key: "files", title: t("userSpace.allFiles"), Icon: Files },
						{ key: "memory", title: t("userSpace.memory"), Icon: Brain },
					] as const
				).map(({ key, title, Icon }) => (
					<button
						key={key}
						role="tab"
						aria-selected={view === key}
						className={cn(
							"flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs",
							view === key ? "bg-background shadow-sm" : "text-muted-foreground",
						)}
						onClick={() => {
							setView(key)
							if (key === "memory") setMemoryVisited(true)
						}}
					>
						<Icon size={14} />
						{title}
					</button>
				))}
			</div>
			<div className={cn("min-h-0 flex-1", view !== "files" && "hidden")} role="tabpanel">
				<UserSpaceFilesView
					active={view === "files"}
					directoryId={directoryId}
					onDirectoryChange={setDirectoryId}
					onFileClick={onFileClick}
					topicId={topicId}
					activeFileId={activeFileId}
				/>
			</div>
			{memoryVisited && (
				<div
					className={cn("min-h-0 flex-1", view !== "memory" && "hidden")}
					role="tabpanel"
				>
					<Suspense
						fallback={
							<p className="p-3 text-xs text-muted-foreground">
								{t("userSpace.loading")}
							</p>
						}
					>
						<UserSpaceMemoryView
							projectId={projectId}
							projectName={projectName}
							topicId={topicId}
							activeFileId={activeFileId}
							onFileClick={onFileClick}
						/>
					</Suspense>
				</div>
			)}
			{onFileClick && (
				<div className="shrink-0 border-t border-border/60 p-2">
					<Button
						variant="ghost"
						className="h-9 w-full justify-start gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
						onClick={() =>
							onFileClick?.({
								file_manager: {
									spaceType: "user",
									view,
									directoryId: view === "files" ? directoryId : undefined,
									projectId: projectId ?? undefined,
									projectName,
									topicId,
								},
							})
						}
					>
						<PanelsTopLeft size={16} />
						{t("userSpace.openManager")}
						<ArrowUpRight size={14} className="ml-auto" />
					</Button>
				</div>
			)}
		</div>
	)
})

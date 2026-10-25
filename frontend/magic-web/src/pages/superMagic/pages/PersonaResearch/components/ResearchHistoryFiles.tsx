import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/shadcn-ui/sheet"
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/shadcn-ui/resizable"
import { useIsMobile } from "@/hooks/useIsMobile"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import PreviewDetailPopup, {
	type PreviewDetail,
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import { resolveRuntimeFileOpen } from "@/pages/share/microApp/hooks/resolveRuntimeFileOpen"
import type { TopicFileRowDecorationResolver } from "@/pages/superMagic/components/TopicFilesButton/topic-file-row-decoration.types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { PersonaFile } from "../types"
import { usePersonaResearchStore } from "../context"
import { getAttachmentPath, normalizeResearchPath } from "../services/researchFiles"
import { routeResearchFile } from "../services/researchFileRouting"
import { TEMPLATE_CHATS_DIR } from "../services/templateChats"
import { useResearchFileDisplayResolver } from "../hooks/useResearchFileDisplayResolver"
import PersonaDetailSheet from "./PersonaDetailSheet"
import ResearchStateView from "./ResearchStateView"

interface ResearchHistoryFilesProps {
	/** The page the sidebar docks beside. It stays mounted when the sidebar opens or closes. */
	children: ReactNode
	open: boolean
	onOpenChange: (open: boolean) => void
}

/**
 * "历史产物": every file of the research project (personas, studies/<slug>/ reports, plans,
 * interviews, templates) in a right-hand sidebar, with a floating preview for the clicked file.
 * Desktop docks the sidebar beside the page; phones use a full-width drawer.
 *
 * Reuses the project file tree (TopicFilesButton: rename, delete, download, upload...) and the
 * shared file preview popup (the same renderers as the study's files tab). The tree reads the
 * research store's own files store and attachment index, so it lists the whole project even
 * when no study is selected; nothing here walks or copies the attachments.
 */
function ResearchHistoryFiles({ children, open, onOpenChange }: ResearchHistoryFilesProps) {
	const { t } = useTranslation("personaResearch")
	const isMobile = useIsMobile()
	const store = usePersonaResearchStore()
	const previewRef = useRef<PreviewDetailPopupRef>(null)
	// Contract files that have their own dialog (a library persona) open it instead of raw JSON.
	const [openedPersona, setOpenedPersona] = useState<PersonaFile | null>(null)

	const openPreview = useMemoizedFn((detail: PreviewDetail) => {
		// Both arguments are the store's own arrays, handed over by reference.
		previewRef.current?.open(detail, store.attachments, store.attachmentList)
	})

	/** Every file click and tool detail from the tree ends here. */
	const openFile = useMemoizedFn((file?: unknown) => {
		const result = resolveRuntimeFileOpen(file)
		if (result.kind !== "preview") return
		const item = file as AttachmentItem
		const route = routeResearchFile(
			getAttachmentPath(item) || normalizeResearchPath(item.file_path),
		)
		if (route.kind === "persona") {
			const persona = store.personaById(route.personaId)
			if (persona) {
				setOpenedPersona(persona)
				return
			}
		}
		openPreview(result.detail)
	})

	// Same readable names as the @ panel: "研究报告", persona names, study titles, template names.
	const resolveFileDisplay = useResearchFileDisplayResolver()
	const resolveRowDecoration = useMemoizedFn<TopicFileRowDecorationResolver>(({ item }) => {
		const display = resolveFileDisplay({
			path: getAttachmentPath(item),
			name: item.file_name ?? item.name ?? "",
			isDirectory: item.is_directory === true,
		})
		return display?.name || display?.icon ? { name: display.name, icon: display.icon } : null
	})
	// template-chats/ holds internal conversation markers, not user files. Only the root level is
	// filtered (a handful of folders), so the tree is never walked or copied per file.
	const visibleTree = useMemo(
		() =>
			store.attachments.filter(
				(item) => !`${getAttachmentPath(item)}/`.startsWith(TEMPLATE_CHATS_DIR),
			),
		[store.attachments],
	)

	const project = store.selectedProject
	const content = project ? (
		<TopicFilesButton
			// The tree needs the research project's own files store, not the global workspace's.
			projectFilesStore={store.projectFilesStore}
			attachments={visibleTree}
			projectId={project.id}
			selectedProject={project}
			selectedTopic={store.selectedTopic}
			setUserSelectDetail={openFile}
			onFileClick={openFile}
			allowEdit={!store.isReadOnly}
			allowDownload
			showTitle={false}
			// Studies keep writing files while the page is open; let users re-read the project.
			showRefresh
			refreshAttachments={() => store.refreshAttachments()}
			resolveTopicFileRowDecoration={resolveRowDecoration}
		/>
	) : (
		<ResearchStateView status="loading" />
	)

	/** Esc closes the docked sidebar when focus is inside it; the preview popup handles its own Esc. */
	const handleKeyDown = useMemoizedFn((event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape" && !event.defaultPrevented) onOpenChange(false)
	})

	const sidebar = (
		<aside
			aria-label={t("historyFiles.title")}
			data-testid="persona-research-history-files"
			className="flex h-full min-w-0 flex-col bg-background"
			onKeyDown={handleKeyDown}
		>
			<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="text-sm font-semibold text-foreground">
						{t("historyFiles.title")}
					</h2>
					<p className="truncate text-xs text-muted-foreground">
						{t("historyFiles.description")}
					</p>
				</div>
				<CloseButton onClick={() => onOpenChange(false)} />
			</div>
			<div className="min-h-0 flex-1">{content}</div>
		</aside>
	)

	return (
		<>
			{isMobile ? (
				<div className="h-full min-h-0">{children}</div>
			) : (
				// Always a panel group so the page (and the composer draft in it) is never remounted;
				// only the sidebar panel comes and goes. The width is remembered per browser.
				<ResizablePanelGroup
					direction="horizontal"
					autoSaveId="persona-research:history-files"
				>
					<ResizablePanel id="page" order={1} minSize={40}>
						{children}
					</ResizablePanel>
					{open ? (
						<>
							<ResizableHandle
								aria-label={t("historyFiles.resize")}
								className="w-1.5 bg-transparent after:w-px after:bg-border hover:after:bg-primary/40 focus-visible:after:bg-primary data-[resize-handle-state=drag]:after:bg-primary"
							/>
							<ResizablePanel
								id="history-files"
								order={2}
								defaultSize={28}
								minSize={20}
								maxSize={50}
							>
								{sidebar}
							</ResizablePanel>
						</>
					) : null}
				</ResizablePanelGroup>
			)}
			{isMobile ? (
				// Radix Sheet traps focus, restores it to the entry button and closes on Esc.
				<Sheet open={open} onOpenChange={onOpenChange}>
					<SheetContent
						side="right"
						showClose={false}
						className="w-full gap-0 p-0 sm:max-w-full"
						data-testid="persona-research-history-files"
					>
						<SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
							<div className="flex min-w-0 flex-col gap-0.5">
								<SheetTitle className="text-sm">
									{t("historyFiles.title")}
								</SheetTitle>
								<SheetDescription className="truncate text-xs">
									{t("historyFiles.description")}
								</SheetDescription>
							</div>
							<CloseButton onClick={() => onOpenChange(false)} />
						</SheetHeader>
						<div className="min-h-0 flex-1">{content}</div>
					</SheetContent>
				</Sheet>
			) : null}
			{/* Outside the sheet so its overlay stacks above the drawer on phones. */}
			<PreviewDetailPopup
				ref={previewRef}
				setUserSelectDetail={(detail) => detail && openPreview(detail)}
				selectedProject={store.selectedProject}
				selectedTopic={store.selectedTopic}
				allowEdit={!store.isReadOnly}
				allowDownload
			/>
			<PersonaDetailSheet
				persona={openedPersona}
				onOpenChange={(next) => {
					if (!next) setOpenedPersona(null)
				}}
				side={isMobile ? "bottom" : "center"}
			/>
		</>
	)
}

function CloseButton({ onClick }: { onClick: () => void }) {
	const { t } = useTranslation("personaResearch")
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-8 shrink-0 text-muted-foreground"
			aria-label={t("historyFiles.close")}
			onClick={onClick}
		>
			<X className="size-4" />
		</Button>
	)
}

export default observer(ResearchHistoryFiles)

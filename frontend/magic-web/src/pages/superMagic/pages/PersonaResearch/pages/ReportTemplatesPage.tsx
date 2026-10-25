import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import {
	ArrowLeft,
	ArrowRight,
	CircleAlert,
	Eye,
	LayoutTemplate,
	Loader2,
	Palette,
	Sparkles,
	SwatchBook,
	Upload,
	X,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	isTopicTaskRunning,
	TaskStatus,
	type Topic,
} from "@/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { usePersonaResearchStore } from "../context"
import ReportTemplateCard, {
	ReportTemplateFrame,
	useFrameRendered,
} from "../components/ReportTemplateCard"
import ResearchChatSheet from "../components/ResearchChatSheet"
import TemplateChatCard from "../components/TemplateChatCard"
import { useReportTemplateHtml } from "../hooks/useReportTemplateHtml"
import { useResearchBack } from "../hooks/useResearchBack"
import { useResearchFileDownload } from "../hooks/useResearchFileDownload"
import { type TemplateChatEntry, useTemplateChats } from "../hooks/useTemplateChats"
import { createProjectTextFile, deleteProjectFile } from "../services/projectFileWriter"
import {
	DEFAULT_REPORT_TEMPLATE_PATH,
	attachmentVersionKey,
	getAttachmentPath,
	reportTemplateName,
} from "../services/researchFiles"
import { saveReportTemplateChoice } from "../services/researchOptions"
import { MAX_TEMPLATE_BYTES, uploadReportTemplate } from "../services/reportTemplates"
import { TEMPLATE_CHATS_DIR, serializeTemplateChatMarker } from "../services/templateChats"

/** What the AI conversation sheet is doing: a new template, or restyling one file. */
type TemplateChat = { mode: "create" } | { mode: "edit"; path: string }

/**
 * Report template library: every templates/*.html in the research project.
 * A template sets only how reports look; studies pick one on the research home, and the agent
 * seeds the built-in "Voices" template into an empty library with the first study.
 */
function ReportTemplatesPage() {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const navigate = useNavigate()
	const goBack = useResearchBack()
	const isMobile = useIsMobile()
	const download = useResearchFileDownload()
	const uploadRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [previewing, setPreviewing] = useState<AttachmentItem | null>(null)
	const [pendingDelete, setPendingDelete] = useState<AttachmentItem | null>(null)
	const [chat, setChat] = useState<TemplateChat | null>(null)
	/** The open conversation once it has started, or one reopened from its card. */
	const [chatTopic, setChatTopic] = useState<Topic | null>(null)
	/** First message to send again when the reopened conversation never reached the AI. */
	const [chatResend, setChatResend] = useState<string | JSONContent | null>(null)
	const [pendingChatDelete, setPendingChatDelete] = useState<TemplateChatEntry | null>(null)
	const templateChats = useTemplateChats()
	/** Template versions when the AI sheet opened; anything new or changed since is its work. */
	const [chatBaseline, setChatBaseline] = useState<Map<string, string>>(new Map())
	const canEdit = !store.isReadOnly
	const templates = store.reportTemplates

	const displayName = (item: AttachmentItem) => {
		const path = getAttachmentPath(item)
		return path === DEFAULT_REPORT_TEMPLATE_PATH
			? t("reportTemplates.defaultName")
			: reportTemplateName(path)
	}

	const openChat = useMemoizedFn((next: TemplateChat) => {
		setChatBaseline(
			new Map(templates.map((item) => [getAttachmentPath(item), attachmentVersionKey(item)])),
		)
		setChatTopic(null)
		setChatResend(null)
		setChat(next)
	})

	/** Reopens an earlier conversation from its card, measuring results from when it began. */
	const reopenChat = useMemoizedFn(({ marker, topic, state }: TemplateChatEntry) => {
		setChatBaseline(new Map(Object.entries(marker.templates_before)))
		setChat(
			marker.mode === "edit" && marker.template_path
				? { mode: "edit", path: marker.template_path }
				: { mode: "create" },
		)
		setChatTopic(topic)
		// Markers written before the request was recorded fall back to the opening prompt.
		setChatResend(
			state === "unsent"
				? ((marker.prompt as JSONContent | undefined) ??
						t("reportTemplates.chat.createPrompt"))
				: null,
		)
		store.selectStudy(topic.id)
	})

	/** Marks the new topic as a template conversation so its card survives closing the panel. */
	const rememberChat = useMemoizedFn((topic: Topic, firstMessage?: JSONContent) => {
		setChatTopic(topic)
		// Keeps it out of the study list right away; the marker file makes that permanent.
		store.markTemplateChat(String(topic.id))
		const marker = serializeTemplateChatMarker({
			schema_version: 1,
			topic_id: String(topic.id),
			mode: chat?.mode ?? "create",
			template_path: chat?.mode === "edit" ? chat.path : undefined,
			templates_before: Object.fromEntries(chatBaseline),
			started_at: new Date().toISOString(),
			prompt: firstMessage as Record<string, unknown> | undefined,
		})
		void createProjectTextFile(store, TEMPLATE_CHATS_DIR, `${topic.id}.json`, marker).then(
			(saved) => {
				if (!saved) console.error("Failed to save the report template chat marker")
			},
		)
	})

	// Live status of the open conversation: the resend notice goes once the message is sent.
	const liveChatTopic = chatTopic
		? (store.topicStore.topics.find((topic) => topic.id === chatTopic.id) ?? chatTopic)
		: null
	const chatNeverStarted =
		Boolean(liveChatTopic) &&
		(!liveChatTopic?.task_status || liveChatTopic.task_status === TaskStatus.WAITING)

	const closeChat = useMemoizedFn(() => {
		if (liveChatTopic && isTopicTaskRunning(liveChatTopic)) {
			toast.info(t("reportTemplates.chat.backgroundHint"))
		}
		setChat(null)
		setChatTopic(null)
		setChatResend(null)
		store.selectStudy(undefined)
	})

	const confirmChatDelete = useMemoizedFn(async () => {
		const entry = pendingChatDelete
		setPendingChatDelete(null)
		if (!entry) return
		try {
			await store.deleteStudy(entry.topic.id)
			if (entry.markerFile.file_id) {
				await deleteProjectFile(store, String(entry.markerFile.file_id))
			}
			toast.success(t("reportTemplates.chatCard.deleted"))
		} catch {
			toast.error(t("reportTemplates.deleteFailed"))
		}
	})

	const chatResults = useMemo(
		() =>
			chat
				? templates.filter(
						(item) =>
							chatBaseline.get(getAttachmentPath(item)) !==
							attachmentVersionKey(item),
					)
				: [],
		[chat, chatBaseline, templates],
	)

	const startWithTemplate = useMemoizedFn((item: AttachmentItem) => {
		saveReportTemplateChoice(getAttachmentPath(item))
		navigate({ name: RouteName.PersonaResearch })
	})

	const onUpload = useMemoizedFn(async (file: File | undefined) => {
		if (!file) return
		setUploading(true)
		const result = await uploadReportTemplate(store, file)
		setUploading(false)
		if (result.ok) {
			toast.success(
				t("reportTemplates.uploaded", { name: result.fileName.replace(/\.html$/, "") }),
			)
			return
		}
		toast.error(
			t(`reportTemplates.uploadProblem.${result.problem}`, {
				size: Math.round(MAX_TEMPLATE_BYTES / 1024),
			}),
		)
	})

	const confirmDelete = useMemoizedFn(async () => {
		const item = pendingDelete
		setPendingDelete(null)
		if (!item?.file_id) return
		const deleted = await deleteProjectFile(store, String(item.file_id))
		if (deleted) toast.success(t("reportTemplates.deleted"))
		else toast.error(t("reportTemplates.deleteFailed"))
	})

	const headerActions = canEdit ? (
		<>
			<Button
				variant="outline"
				size="sm"
				disabled={uploading}
				onClick={() => uploadRef.current?.click()}
			>
				<Upload className="size-3.5" />
				{uploading ? t("reportTemplates.uploading") : t("reportTemplates.upload")}
			</Button>
			<Button size="sm" onClick={() => openChat({ mode: "create" })}>
				<Sparkles className="size-3.5" />
				{t("reportTemplates.createWithAi")}
			</Button>
		</>
	) : null

	return (
		<div
			className="relative flex h-full min-h-0 flex-col bg-background"
			data-testid="persona-research-templates"
		>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
				<MagicTooltip title={t("study.backHome")}>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("study.backHome")}
						onClick={goBack}
					>
						<ArrowLeft className="size-4" />
					</Button>
				</MagicTooltip>
				<div className="flex min-w-0 flex-1 flex-col">
					<h1 className="text-sm font-semibold leading-5">
						{t("reportTemplates.title")}
					</h1>
					<p
						className={cn(
							"text-xs leading-4 text-muted-foreground",
							isMobile ? "line-clamp-2" : "truncate",
						)}
					>
						{t("reportTemplates.subtitle")}
					</p>
				</div>
				{isMobile ? null : headerActions}
				<input
					ref={uploadRef}
					type="file"
					accept=".html,.htm,text/html"
					className="hidden"
					onChange={(event) => {
						void onUpload(event.target.files?.[0])
						event.target.value = ""
					}}
				/>
			</div>
			{isMobile && canEdit ? (
				<div className="flex shrink-0 gap-2 border-b border-border px-4 py-2">
					{headerActions}
				</div>
			) : null}

			<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
				<div className="mx-auto w-full max-w-6xl p-4">
					{templates.length === 0 && templateChats.length === 0 ? (
						<Empty className="py-16">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<LayoutTemplate className="size-5" />
								</EmptyMedia>
								<EmptyTitle>{t("reportTemplates.emptyTitle")}</EmptyTitle>
								<EmptyDescription>{t("reportTemplates.empty")}</EmptyDescription>
							</EmptyHeader>
							{headerActions ? (
								<EmptyContent className="flex-row justify-center">
									{headerActions}
								</EmptyContent>
							) : null}
						</Empty>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
							{templateChats.map((entry) => (
								<TemplateChatCard
									key={entry.marker.topic_id}
									entry={entry}
									onOpen={() => reopenChat(entry)}
									onDelete={
										canEdit ? () => setPendingChatDelete(entry) : undefined
									}
								/>
							))}
							{templates.map((item) => {
								const path = getAttachmentPath(item)
								return (
									<ReportTemplateCard
										key={path}
										item={item}
										name={reportTemplateName(path)}
										isDefault={path === DEFAULT_REPORT_TEMPLATE_PATH}
										onPreview={() => setPreviewing(item)}
										onUse={() => startWithTemplate(item)}
										onDownload={() =>
											download(
												item.file_id ? String(item.file_id) : undefined,
												path.slice(path.lastIndexOf("/") + 1),
											)
										}
										onEditWithAi={
											canEdit
												? () => openChat({ mode: "edit", path })
												: undefined
										}
										onDelete={
											canEdit ? () => setPendingDelete(item) : undefined
										}
									/>
								)
							})}
						</div>
					)}
				</div>
			</ScrollArea>

			<TemplatePreviewDialog
				item={previewing}
				name={previewing ? displayName(previewing) : ""}
				onOpenChange={(open) => !open && setPreviewing(null)}
				onUse={startWithTemplate}
			/>

			<ResearchChatSheet
				open={Boolean(chat)}
				onOpenChange={(open) => !open && closeChat()}
				topic={chatTopic}
				onTopicChange={rememberChat}
				resend={
					chatResend && chatNeverStarted
						? { notice: t("reportTemplates.chat.unsentNotice"), content: chatResend }
						: undefined
				}
				title={
					chat?.mode === "edit"
						? t("reportTemplates.chat.editTitle")
						: t("reportTemplates.chat.title")
				}
				intro={{
					title:
						chat?.mode === "edit"
							? t("reportTemplates.chat.editIntroTitle", {
									name: reportTemplateName(chat.path),
								})
							: t("reportTemplates.chat.introTitle"),
					text: t("reportTemplates.chat.introText"),
					tips: [
						{ icon: Upload, text: t("reportTemplates.chat.tipUpload") },
						{ icon: Palette, text: t("reportTemplates.chat.tipDescribe") },
						{ icon: SwatchBook, text: t("reportTemplates.chat.tipBase") },
					],
					prompt:
						chat?.mode === "edit"
							? t("reportTemplates.chat.editPrompt", { path: chat.path })
							: t("reportTemplates.chat.createPrompt"),
					disclaimer: t("reportTemplates.chat.disclaimer"),
					placeholder: t("reportTemplates.chat.placeholder"),
					draftSlot: "report-template",
				}}
				footer={
					chatResults.length ? (
						<div className="flex shrink-0 items-center gap-3 border-t border-border bg-emerald-500/[0.05] px-4 py-2.5 animate-in fade-in-0 motion-reduce:animate-none">
							<span className="min-w-0 flex-1 truncate text-xs text-foreground">
								{t("reportTemplates.chat.saved", {
									names: chatResults.map(displayName).join(" · "),
								})}
							</span>
							<Button size="sm" onClick={() => setPreviewing(chatResults[0])}>
								<Eye className="size-3.5" />
								{t("reportTemplates.previewAction")}
							</Button>
						</div>
					) : null
				}
			/>

			<AlertDialog
				open={Boolean(pendingChatDelete)}
				onOpenChange={(open) => !open && setPendingChatDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("reportTemplates.chatCard.deleteTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("reportTemplates.chatCard.deleteDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("library.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => void confirmChatDelete()}
						>
							{t("library.deleteConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(pendingDelete)}
				onOpenChange={(open) => !open && setPendingDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("reportTemplates.deleteTitle", {
								name: pendingDelete ? displayName(pendingDelete) : "",
							})}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingDelete &&
							getAttachmentPath(pendingDelete) === DEFAULT_REPORT_TEMPLATE_PATH
								? t("reportTemplates.deleteDefaultDescription")
								: t("reportTemplates.deleteDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("library.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => void confirmDelete()}
						>
							{t("library.deleteConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

/** Full-size preview of one template, with the main next step. */
function TemplatePreviewDialog({
	item,
	name,
	onOpenChange,
	onUse,
}: {
	item: AttachmentItem | null
	name: string
	onOpenChange: (open: boolean) => void
	onUse: (item: AttachmentItem) => void
}) {
	const { t } = useTranslation("personaResearch")
	const { html, failed } = useReportTemplateHtml(item)
	const [rendered, onRendered] = useFrameRendered(html)
	// Templates load their fonts and styles from CDNs; say so if that takes a while.
	const [slow, setSlow] = useState(false)
	useEffect(() => {
		setSlow(false)
		if (!html || rendered) return
		const timer = window.setTimeout(() => setSlow(true), SLOW_PREVIEW_MS)
		return () => window.clearTimeout(timer)
	}, [html, rendered])
	return (
		<Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="flex h-[88vh] max-w-5xl flex-col gap-0 p-0 sm:max-w-5xl"
			>
				{/* One row, one centre line: title, main action and close share the 32px height. */}
				<DialogHeader className="h-14 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-4">
					<DialogTitle className="min-w-0 flex-1 truncate text-sm leading-5">
						{name}
					</DialogTitle>
					<DialogDescription className="sr-only">
						{t("reportTemplates.subtitle")}
					</DialogDescription>
					{item ? (
						<Button size="sm" onClick={() => onUse(item)}>
							{t("reportTemplates.use")}
							<ArrowRight className="size-3.5" />
						</Button>
					) : null}
					<DialogClose asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-8 text-muted-foreground"
							aria-label={t("reportTemplates.close")}
						>
							<X className="size-4" />
						</Button>
					</DialogClose>
				</DialogHeader>
				<div className="relative min-h-0 flex-1 bg-muted">
					{html ? (
						<ReportTemplateFrame
							html={html}
							title={name}
							onLoad={onRendered}
							className="h-full w-full"
						/>
					) : null}
					{failed ? (
						<PreviewState icon={<CircleAlert className="size-5 text-destructive" />}>
							{t("reportTemplates.previewFailed")}
						</PreviewState>
					) : !rendered ? (
						<PreviewState
							icon={
								<Loader2 className="size-5 animate-spin motion-reduce:animate-none" />
							}
						>
							{html ? t("reportTemplates.rendering") : t("reportTemplates.loading")}
							{slow ? (
								<span className="max-w-xs text-center text-muted-foreground">
									{t("reportTemplates.renderingSlow")}
								</span>
							) : null}
						</PreviewState>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	)
}

/** Centred status over the preview area while the frame loads or after it failed. */
function PreviewState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<div
			className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-xs text-foreground"
			role="status"
		>
			{icon}
			{children}
		</div>
	)
}

/** After this long without a rendered preview, explain that external resources are slow. */
const SLOW_PREVIEW_MS = 8000

export default observer(ReportTemplatesPage)

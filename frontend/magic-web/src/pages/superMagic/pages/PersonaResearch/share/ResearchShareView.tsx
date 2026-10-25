import { useEffect, useRef, useState, type ReactNode } from "react"
import { FileSearch, Info, Link2, MessagesSquare, UsersRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { RouteName } from "@/routes/constants"
import { getRoutePath } from "@/routes/history/helpers"
import { PersonaResearchStoreProvider, usePersonaResearchStore } from "../context"
import PersonaAvatar from "../components/PersonaAvatar"
import PersonaDetailSheet from "../components/PersonaDetailSheet"
import ResearchConsole, {
	ResearchConsoleSkeleton,
	type ResearchConsoleTab,
} from "../components/ResearchConsole"
import StudyStepper from "../components/StudyStepper"
import type { PersonaFile } from "../types"
import ShareDocumentPane from "./ShareDocumentPane"

export interface ResearchShareViewProps {
	topicId: string
	topicName: string
	projectId: string
	projectName: string
	/** Share file list as loaded by the share page: `{ tree, list }`. */
	attachments: { tree?: AttachmentItem[]; list?: AttachmentItem[] }
	access: FileAccessContext
	/** The ordinary conversation replay, kept as the last view. */
	replay: ReactNode
	isMobile: boolean
}

/**
 * Share page for an AI research topic: the study's results first (conclusions, personas,
 * interviews, analysis, report, questionnaire), the conversation replay last. Read-only.
 */
export default function ResearchShareView(props: ResearchShareViewProps) {
	return (
		<PersonaResearchStoreProvider bootstrap={false}>
			<ResearchShareBody {...props} />
		</PersonaResearchStoreProvider>
	)
}

const ResearchShareBody = observer(function ResearchShareBody({
	topicId,
	topicName,
	projectId,
	projectName,
	attachments,
	access,
	replay,
	isMobile,
}: ResearchShareViewProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const [view, setView] = useState<"results" | "replay">("results")
	const [consoleTab, setConsoleTab] = useState<ResearchConsoleTab>("hypotheses")
	const [focusedInterviewId, setFocusedInterviewId] = useState<string | null>(null)
	const [openedPersona, setOpenedPersona] = useState<PersonaFile | null>(null)
	const [openedFile, setOpenedFile] = useState<AttachmentItem | null>(null)

	// The share page loads files in pages; feed the store again whenever the list grows.
	const list = attachments.list
	useEffect(() => {
		if (!list) return
		store.initShare({
			topic: {
				id: topicId,
				topic_name: topicName,
				task_status: TaskStatus.FINISHED,
			} as Topic,
			project: { id: projectId, project_name: projectName } as ProjectListItem,
			tree: attachments.tree ?? [],
			list,
			access,
		})
		// attachments.tree changes together with list.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [access, list, projectId, projectName, store, topicId, topicName])

	const study = store.study
	const studyAttachments = store.studyAttachments
	const isLoading = !list || store.isStudyContentLoading
	// Without study files (the sharer hid the file list) only the replay is meaningful.
	const hasResults = Boolean(study || studyAttachments)
	const activeView = !isLoading && !hasResults ? "replay" : view
	const report = studyAttachments?.report ?? null
	const documentFile = openedFile ?? report ?? studyAttachments?.plan ?? null

	// Land on the report once it is known; later tab choices are the viewer's.
	const landedOnReportRef = useRef(false)
	useEffect(() => {
		if (!report || landedOnReportRef.current) return
		landedOnReportRef.current = true
		setConsoleTab("report")
	}, [report])

	const sharedTopic = store.selectedTopic
	const title =
		(sharedTopic && store.studyTitleOf(sharedTopic)) || topicName || t("study.untitled")

	// Persona building has no plan, interviews or report: no phase stepper and no study scale.
	const isPersonaBuild = study?.study_type === "persona_build"
	const metaChips = [
		study?.study_type ? t(`studyType.${camel(study.study_type)}`) : null,
		study?.framework?.length ? study.framework.join(" · ") : null,
		study?.limits?.personas && !isPersonaBuild
			? t("study.scale", {
					personas: study.limits.personas,
					rounds: study.limits.interview_rounds ?? 20,
				})
			: null,
		// Only platforms that desk research actually sampled; unavailable or skipped sampling shows nothing.
		study?.social_sampling?.status === "sampled" && study.social_sampling.platforms.length
			? t("study.socialSampled", { platforms: study.social_sampling.platforms.join(" / ") })
			: null,
	].filter((chip): chip is string => Boolean(chip))

	const copyLink = () => {
		navigator.clipboard
			.writeText(window.location.href)
			.then(() => toast.success(t("share.linkCopied")))
			.catch(() => toast.error(t("share.copyFailed")))
	}
	const researchHomeHref =
		getRoutePath({ name: RouteName.PersonaResearch }) ?? window.location.origin

	const showStandaloneBar = isMobile || activeView === "replay" || isLoading

	const titleBlock = (
		<div className="flex min-w-0 shrink items-center gap-2.5">
			<h1
				className="min-w-0 max-w-[22rem] truncate text-[15px] font-bold tracking-tight text-foreground"
				title={title}
			>
				{title}
			</h1>
			{store.studyPersonas.length && !isMobile ? (
				<span className="flex shrink-0 -space-x-1.5">
					{store.studyPersonas.slice(0, 6).map((persona) => (
						<PersonaAvatar
							key={persona.id}
							id={persona.id}
							name={persona.name}
							className="size-5 ring-2 ring-background"
						/>
					))}
				</span>
			) : null}
			{/* Method, scale and the AI-sample note sit behind one short label instead of a meta row. */}
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						tabIndex={0}
						className="inline-flex shrink-0 cursor-help items-center gap-1 rounded text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<Info className="size-3.5" />
						{t("share.aiShort")}
					</span>
				</TooltipTrigger>
				<TooltipContent className="max-w-72 text-xs leading-5">
					{metaChips.length ? <p>{metaChips.join(" · ")}</p> : null}
					<p>{t("study.aiDisclaimer")}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	)

	const actions = (
		<div className="flex items-center gap-1.5">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("share.copyLink")}
						onClick={copyLink}
					>
						<Link2 className="size-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("share.copyLink")}</TooltipContent>
			</Tooltip>
			{/* The global link hover colour would turn the label blue on the dark fill; pin it. */}
			<Button
				size="sm"
				className="h-8 gap-1.5 rounded-full px-3 text-primary-foreground hover:text-primary-foreground"
				asChild
			>
				{/* Visitors land on the research home (sign-in first when needed). */}
				<a href={researchHomeHref} target="_blank" rel="noreferrer">
					<UsersRound className="size-3.5" />
					{isMobile ? t("share.makeYourOwnShort") : t("share.makeYourOwn")}
				</a>
			</Button>
			{hasResults ? (
				// Results / replay as a small segmented switch at the end of the row.
				<Tabs value={activeView} onValueChange={(value) => setView(value as typeof view)}>
					<TabsList className="h-8 rounded-full p-0.5">
						<TabsTrigger
							value="results"
							className="h-7 gap-1 rounded-full px-2.5 text-xs"
						>
							<FileSearch className="size-3.5" />
							{isMobile ? null : t("share.results")}
						</TabsTrigger>
						<TabsTrigger
							value="replay"
							className="h-7 gap-1 rounded-full px-2.5 text-xs"
						>
							<MessagesSquare className="size-3.5" />
							{isMobile ? null : t("share.replay")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
			) : null}
		</div>
	)

	const openFile = (file: AttachmentItem) => {
		setOpenedFile(file)
		setConsoleTab("files")
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-background"
			data-testid="persona-research-share"
		>
			{/* One compact row instead of a cover: in the results view it lives inside the tab bar
			    (toolbarStart / toolbarEnd), so the report gets nearly the whole height. */}
			{showStandaloneBar ? (
				<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
					{titleBlock}
					<div className="ml-auto shrink-0">{actions}</div>
				</header>
			) : null}
			{activeView === "results" && !isPersonaBuild && study && study.phase !== "done" ? (
				// Only an unfinished study shows its phases; a finished one goes straight to results.
				<div className="shrink-0 border-b border-border px-4 py-2">
					<StudyStepper study={study} compact />
				</div>
			) : null}

			{!isLoading && !hasResults ? (
				<p className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
					{t("share.noStudyFiles")}
				</p>
			) : null}

			<div className="min-h-0 flex-1">
				{activeView === "replay" ? (
					replay
				) : isLoading ? (
					<ResearchConsoleSkeleton />
				) : (
					<ResearchConsole
						activeTab={consoleTab}
						onTabChange={setConsoleTab}
						focusedInterviewPersonaId={focusedInterviewId}
						onFocusInterview={setFocusedInterviewId}
						onOpenPersona={setOpenedPersona}
						onOpenFile={openFile}
						onRequestValidationUpload={() => undefined}
						variant={isMobile ? "mobile" : "desktop"}
						toolbarStart={isMobile ? undefined : titleBlock}
						toolbarEnd={isMobile ? undefined : actions}
						reportPane={<ShareDocumentPane file={report} />}
						filesPane={<ShareDocumentPane file={documentFile} />}
						activeFileId={documentFile ? String(documentFile.file_id) : null}
					/>
				)}
			</div>

			<PersonaDetailSheet
				persona={openedPersona}
				interview={
					openedPersona
						? (store.interviews.find((ref) => ref.data.persona_id === openedPersona.id)
								?.data ?? null)
						: null
				}
				onOpenChange={(open) => !open && setOpenedPersona(null)}
				onOpenInterview={(personaId) => {
					setOpenedPersona(null)
					setFocusedInterviewId(personaId)
					setConsoleTab("interviews")
				}}
				side={isMobile ? "bottom" : "center"}
			/>
		</div>
	)
})

/** "user_research" → "userResearch", matching the studyType locale keys. */
function camel(value: string) {
	return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

import { useRef, useState } from "react"
import { ChevronRight, Ellipsis, PencilLine, Share2, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import MagicTooltip from "@/components/base/MagicTooltip"
import dayjs from "@/infrastructure/vendors/dayjs"
import TopicSharePopover from "@/pages/superMagic/components/TopicSharePopover"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { useStudyRename } from "../hooks/useStudyRename"
import { resolveStudyStatus } from "../services/studyStatus"
import type { StudyFile } from "../types"
import {
	StudyProgressSegments,
	StudyStatusBadge,
	StudyStatusBadgeSkeleton,
} from "./StudyStatusBadge"

interface StudyListItemProps {
	topic: Topic
	onOpen: (topic: Topic) => void
	onDelete: (topic: Topic) => void
}

/**
 * One study row: title with method and scale, outcome (verdict mix or progress), status and
 * relative update time.
 * Studies waiting for the user's answer get a subtle highlight so they are found first.
 */
function StudyListItem({ topic, onOpen, onDelete }: StudyListItemProps) {
	const { t, i18n } = useTranslation("personaResearch")
	const isMobile = useIsMobile()
	// Instance locale, so the row does not inherit another component's global dayjs locale.
	const dayjsLocale = i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en"
	const store = usePersonaResearchStore()
	const study = store.studyFileOf(topic)
	const status = resolveStudyStatus(topic, study)
	const title = store.studyTitleOf(topic) || t("study.untitled")
	const rename = useStudyRename(topic.id, store.studyTitleOf(topic))
	const [shareOpen, setShareOpen] = useState(false)
	// Sharing a study before it finishes would publish a half-written result.
	const shareable = status.kind === "done"
	// Rename and share take focus themselves; returning it to "…" would close them at once.
	const keepFocusAwayRef = useRef(false)
	const menuButtonRef = useRef<HTMLButtonElement>(null)
	const isPersonaBuild = study?.study_type === "persona_build"
	// No phase progress for plain conversations (topics without a study file).
	const isConversation = status.kind === "conversation"

	const studyTypeLabel = study?.study_type
		? {
				user_research: t("studyType.userResearch"),
				product_rnd: t("studyType.productRnd"),
				concept_test: t("studyType.conceptTest"),
				fast_insight: t("studyType.fastInsight"),
				panel_only: t("studyType.panelOnly"),
				persona_build: t("studyType.personaBuild"),
			}[study.study_type]
		: null
	const meta = [
		studyTypeLabel,
		study?.limits?.personas && !isPersonaBuild
			? t("study.scale", {
					personas: study.limits.personas,
					rounds: study.limits.interview_rounds ?? 20,
				})
			: null,
	]
		.filter(Boolean)
		.join(" · ")
	const hasVerdicts = Boolean(
		study?.hypotheses?.some(
			(item) => item.verdict !== "pending" && item.verdict !== "insufficient",
		),
	)

	return (
		<li
			className={cn(
				// Columns as in the prototype: study, outcome, status, time, actions.
				"group relative flex items-center gap-5 px-1 py-3.5 transition-colors hover:bg-muted/40",
				status.kind === "waiting_user" && "bg-amber-500/[0.06]",
			)}
		>
			{rename.draft !== null ? (
				<div className="min-w-0 flex-1">
					<Input
						autoFocus
						value={rename.draft}
						disabled={rename.isSaving}
						placeholder={t("study.untitled")}
						aria-label={t("study.rename")}
						className="h-8 text-[14.5px] font-medium"
						onChange={(event) => rename.setDraft(event.target.value)}
						onBlur={() => void rename.commit()}
						onKeyDown={rename.onKeyDown}
						onFocus={(event) => event.target.select()}
					/>
				</div>
			) : (
				<button
					type="button"
					className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => onOpen(topic)}
				>
					<span className="truncate text-[14.5px] font-medium text-foreground">
						{title}
					</span>
					{store.studyFilesReady ? (
						<span
							className={cn(
								"text-xs text-muted-foreground",
								// Two lines on phones: "up to 20 rounds each" was cut to "up t…".
								isMobile ? "line-clamp-2" : "truncate",
							)}
						>
							{meta ||
								(isConversation
									? null
									: t("study.progress", {
											done: status.completed,
											total: status.total,
										}))}
						</span>
					) : (
						<Skeleton className="h-3 w-40" />
					)}
				</button>
			)}
			{/* Outcome column: verdict mix once concluded, otherwise how far the study got. */}
			<span className="hidden w-44 shrink-0 md:block">
				{!store.studyFilesReady ? (
					<Skeleton className="h-1.5 w-full" />
				) : hasVerdicts && study ? (
					<VerdictSummary study={study} />
				) : isPersonaBuild || isConversation ? null : (
					<span className="flex flex-col gap-1.5">
						<StudyProgressSegments status={status} className="w-full" />
						<span className="text-xs tabular-nums text-muted-foreground">
							{t("study.progress", { done: status.completed, total: status.total })}
						</span>
					</span>
				)}
			</span>
			{/* Fits the longest status ("等你回复", "Researching") on one line; keeps rows aligned. */}
			<span className="hidden w-[6.5rem] shrink-0 items-center sm:flex">
				{store.studyFilesReady ? (
					<StudyStatusBadge status={status} />
				) : (
					<StudyStatusBadgeSkeleton />
				)}
			</span>
			<span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
				{topic.updated_at ? dayjs(topic.updated_at).locale(dayjsLocale).fromNow() : null}
			</span>
			<DropdownMenu>
				<MagicTooltip title={t("home.moreActions")}>
					<DropdownMenuTrigger asChild>
						<Button
							ref={menuButtonRef}
							variant="ghost"
							size="icon"
							className="size-8 opacity-60 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
							aria-label={t("home.moreActions")}
						>
							<Ellipsis className="size-4" />
						</Button>
					</DropdownMenuTrigger>
				</MagicTooltip>
				<DropdownMenuContent
					align="end"
					className="min-w-40"
					onCloseAutoFocus={(event) => {
						if (!keepFocusAwayRef.current) return
						keepFocusAwayRef.current = false
						event.preventDefault()
					}}
				>
					{rename.editable ? (
						<DropdownMenuItem
							onSelect={() => {
								keepFocusAwayRef.current = true
								rename.start()
							}}
						>
							<PencilLine className="size-4" />
							{t("home.rename")}
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem
						disabled={!shareable}
						onSelect={() => {
							// The menu hands focus back to "…" as it closes; the dialog opened next returns
							// focus there again when it closes.
							window.setTimeout(() => setShareOpen(true), 0)
						}}
					>
						<Share2 className="size-4" />
						<span className="flex flex-col">
							{t("home.share")}
							{shareable ? null : (
								<span className="text-xs text-muted-foreground">
									{t("home.shareUnavailable")}
								</span>
							)}
						</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem className="text-destructive" onSelect={() => onDelete(topic)}>
						<Trash2 className="size-4" />
						{t("home.delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{/* Without an anchor the share panel opens as a centred dialog titled with the study
			    (a bottom sheet on phones): the same content as the studio's share button, and no
			    panel hanging off the row edge or over its neighbours. */}
			<TopicSharePopover
				open={shareOpen}
				onOpenChange={setShareOpen}
				topicId={topic.id}
				topicTitle={title}
				fileListOffHint={t("share.fileListOffHint")}
				// The menu item that opened it is gone; give focus back to this row's "…".
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					menuButtonRef.current?.focus()
				}}
			/>
			<ChevronRight
				aria-hidden
				className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
			/>
		</li>
	)
}

/** Verdict mix of a study's hypotheses: what the study concluded, readable from the list. */
function VerdictSummary({ study }: { study: StudyFile }) {
	const { t } = useTranslation("personaResearch")
	const hypotheses = study.hypotheses ?? []
	const supported = hypotheses.filter((item) => item.verdict === "supported").length
	const mixed = hypotheses.filter((item) => item.verdict === "mixed").length
	const refuted = hypotheses.filter((item) => item.verdict === "refuted").length
	if (supported + mixed + refuted === 0) return null
	const parts = [
		{ count: supported, className: "bg-emerald-600", label: t("verdict.supported") },
		{ count: mixed, className: "bg-amber-500", label: t("verdict.mixed") },
		{ count: refuted, className: "bg-rose-500", label: t("verdict.refuted") },
	].filter((part) => part.count > 0)
	return (
		<span className="flex flex-col gap-1.5">
			<span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
				{parts.map((part) => (
					<span
						key={part.label}
						className={part.className}
						style={{ flexGrow: part.count }}
					/>
				))}
			</span>
			<span className="truncate text-xs text-muted-foreground">
				{parts.map((part) => `${part.count} ${part.label}`).join(" · ")}
			</span>
		</span>
	)
}

export default observer(StudyListItem)

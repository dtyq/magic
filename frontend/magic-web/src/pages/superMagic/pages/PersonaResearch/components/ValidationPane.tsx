import { ClipboardCheck, FileSpreadsheet, Upload, Users } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import type { AgreementLevel } from "../types"
import MarkdownFilePane from "./MarkdownFilePane"
import { AgreementBadge, VerdictBadge } from "./ResearchBadges"
import { CARD_SURFACE } from "./surface"

interface ValidationPaneProps {
	/** Switches to the conversation and prefills the "compare real answers" request. */
	onRequestUpload: () => void
	onOpenFile: (file: AttachmentItem) => void
}

const ROW_TONE: Record<AgreementLevel, string> = {
	agree: "",
	partial: "bg-amber-500/[0.06]",
	disagree: "bg-destructive/[0.06]",
}

/**
 * Real-person validation: the questionnaire to send, then the AI-vs-human comparison once
 * answers are uploaded. Upload reuses conversation attachments; the agent writes the results.
 */
function ValidationPane({ onRequestUpload, onOpenFile }: ValidationPaneProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const attachments = store.studyAttachments
	const questionnaire = attachments?.validation ?? null
	const csv = attachments?.validationCsv ?? null
	const results = store.validationResults
	const hypotheses = store.study?.hypotheses ?? []
	const statementOf = (id: string) => hypotheses.find((item) => item.id === id)?.statement ?? id

	if (!questionnaire && !results) {
		return (
			<Empty className="h-full border-0 py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ClipboardCheck />
					</EmptyMedia>
					<EmptyTitle className="text-sm">{t("console.validationEmptyTitle")}</EmptyTitle>
					<EmptyDescription className="text-xs">
						{t("console.validationEmpty")}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		// Same as the analysis board: keep the Radix table wrapper from widening past the viewport.
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className="mx-auto flex max-w-3xl flex-col gap-5 p-4">
				<div className={cn(CARD_SURFACE, "flex flex-wrap items-center gap-2 p-3")}>
					<Users className="size-4 text-muted-foreground" />
					{/* min-w keeps the sentence readable; the buttons wrap below it on narrow screens. */}
					<span className="min-w-40 flex-1 text-sm">
						{results
							? t("validation.validatedCount", { count: results.respondent_count })
							: t("validation.notYet")}
					</span>
					{csv ? (
						<Button variant="outline" size="sm" onClick={() => onOpenFile(csv)}>
							<FileSpreadsheet className="size-4" />
							{t("validation.csv")}
						</Button>
					) : null}
					{store.isReadOnly ? null : (
						<Button size="sm" onClick={onRequestUpload}>
							<Upload className="size-4" />
							{t("validation.upload")}
						</Button>
					)}
				</div>

				{results ? (
					<section className="flex flex-col gap-3">
						{results.summary ? (
							<p className={cn(CARD_SURFACE, "p-3.5 text-sm leading-6")}>
								{results.summary}
							</p>
						) : null}
						<h3 className="text-sm font-semibold">{t("validation.byHypothesis")}</h3>
						<div className={cn(CARD_SURFACE, "overflow-x-auto")}>
							<table className="w-full border-collapse text-xs">
								<thead className="bg-muted/40 text-left text-muted-foreground">
									<tr>
										<th className="px-3 py-2 font-medium">
											{t("validation.hypothesis")}
										</th>
										<th className="px-3 py-2 font-medium">
											{t("validation.ai")}
										</th>
										<th className="px-3 py-2 font-medium">
											{t("validation.human")}
										</th>
										<th className="px-3 py-2 font-medium">
											{t("validation.agreement")}
										</th>
									</tr>
								</thead>
								<tbody>
									{results.by_hypothesis.map((row) => (
										<tr
											key={row.hypothesis_id}
											className={cn(
												"border-t border-border align-top",
												ROW_TONE[row.agreement],
											)}
										>
											<td className="px-3 py-2.5">
												<span className="font-mono text-[11px] text-muted-foreground">
													{row.hypothesis_id}
												</span>
												<p className="leading-5">
													{statementOf(row.hypothesis_id)}
												</p>
												{row.summary ? (
													<p className="mt-1 leading-5 text-muted-foreground">
														{row.summary}
													</p>
												) : null}
												{row.human_quotes?.length ? (
													<ul className="mt-1.5 flex flex-col gap-1">
														{row.human_quotes
															.slice(0, 3)
															.map((quote, index) => (
																<li
																	key={index}
																	className="border-l-2 border-border pl-2 italic text-muted-foreground"
																>
																	“{quote}”
																</li>
															))}
													</ul>
												) : null}
											</td>
											<td className="px-3 py-2.5">
												{row.ai_verdict ? (
													<VerdictBadge verdict={row.ai_verdict} />
												) : (
													"—"
												)}
											</td>
											<td className="px-3 py-2.5">
												{row.human_verdict ? (
													<VerdictBadge verdict={row.human_verdict} />
												) : (
													"—"
												)}
											</td>
											<td className="px-3 py-2.5">
												<AgreementBadge agreement={row.agreement} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{results.by_question?.length ? (
							<>
								<h3 className="text-sm font-semibold">
									{t("validation.byQuestion")}
								</h3>
								<ul className="flex flex-col gap-2">
									{results.by_question.map((row) => (
										<li
											key={row.question_id}
											className={cn(
												CARD_SURFACE,
												"p-3 text-xs",
												ROW_TONE[row.agreement],
											)}
										>
											<div className="mb-2 flex items-center gap-2">
												<span className="font-mono text-[11px] text-muted-foreground">
													{row.question_id}
													{row.hypothesis_id
														? ` · ${row.hypothesis_id}`
														: ""}
												</span>
												<AgreementBadge
													agreement={row.agreement}
													className="ml-auto"
												/>
											</div>
											<div className="grid gap-2 sm:grid-cols-2">
												<div className="rounded-lg bg-muted/50 p-2 leading-5">
													<div className="mb-0.5 text-[11px] text-muted-foreground">
														{t("validation.ai")}
													</div>
													{row.ai_summary}
												</div>
												<div className="rounded-lg bg-muted/50 p-2 leading-5">
													<div className="mb-0.5 text-[11px] text-muted-foreground">
														{t("validation.human")}
													</div>
													{row.human_summary}
												</div>
											</div>
										</li>
									))}
								</ul>
							</>
						) : null}
					</section>
				) : null}

				{questionnaire ? (
					<section className="flex flex-col gap-2">
						<h3 className="text-sm font-semibold">{t("validation.questionnaire")}</h3>
						<div className={cn(CARD_SURFACE, "p-4")}>
							<MarkdownFilePane file={questionnaire} copyable />
						</div>
					</section>
				) : null}
			</div>
		</ScrollArea>
	)
}

export default observer(ValidationPane)

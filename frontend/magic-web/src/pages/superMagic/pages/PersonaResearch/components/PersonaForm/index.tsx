import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { ChevronDown, Info, MessagesSquare, ShieldAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import {
	REQUIRED_PERSONA_FIELDS,
	formCompleteness,
	formToPersona,
	isFieldFilled,
} from "../../services/personaRules"
import type { PersonaFile, ResearchFileRef } from "../../types"
import PersonaCard from "../PersonaCard"
import PersonaFormSection from "./PersonaFormSections"
import { SECTION_FIELDS, usePersonaForm, type PersonaFormSectionKey } from "./usePersonaForm"

interface PersonaFormDialogProps {
	open: boolean
	/** Persona being edited; null creates a manual persona. */
	editing: ResearchFileRef<PersonaFile> | null
	onOpenChange: (open: boolean) => void
	onSaved: (personaId: string) => void
	/** Switches to the conversational builder for users who would rather describe the person. */
	onSwitchToChat?: () => void
}

const SECTION_ORDER: PersonaFormSectionKey[] = ["basic", "needs", "mind", "voice"]

/** Manual persona form: grouped sections, required checks and a live card preview. */
export default function PersonaFormDialog({
	open,
	editing,
	onOpenChange,
	onSaved,
	onSwitchToChat,
}: PersonaFormDialogProps) {
	const { t } = useTranslation("personaResearch")
	const isMobile = useIsMobile()
	const form = usePersonaForm({ open, editing })
	const { values, missing } = form

	const sectionCopy: Record<PersonaFormSectionKey, { title: string; hint: string }> = {
		basic: { title: t("form.section.basic"), hint: t("form.section.basicHint") },
		needs: { title: t("form.section.needs"), hint: t("form.section.needsHint") },
		mind: { title: t("form.section.mind"), hint: t("form.section.mindHint") },
		voice: { title: t("form.section.voice"), hint: t("form.section.voiceHint") },
	}

	const preview = useMemo(
		() =>
			formToPersona(values, {
				id: editing?.data.id ?? "p_preview",
				base: editing?.data,
			}),
		[editing, values],
	)
	const completeness = formCompleteness(values)
	const requiredDone = REQUIRED_PERSONA_FIELDS.filter((field) => isFieldFilled(values, field))
	// The fields that most change how specific simulated answers are.
	const suggestions = [
		!isFieldFilled(values, "story") && t("form.story"),
		!isFieldFilled(values, "pains") && t("form.pains"),
		!isFieldFilled(values, "techAdoption") && t("form.techAdoption"),
		!isFieldFilled(values, "decisionWeights") && t("form.decisionWeights"),
	].filter((item): item is string => Boolean(item))
	const identifierLabels = form.identifierKinds.map((kind) =>
		kind === "phone"
			? t("form.identifierKind.phone")
			: kind === "email"
				? t("form.identifierKind.email")
				: t("form.identifierKind.idCard"),
	)

	const submit = useMemoizedFn(async (allowIdentifiers = false) => {
		const result = await form.save(allowIdentifiers)
		if (result.kind === "invalid") {
			// Wait for collapsed sections to open, then bring the first missing field into view.
			requestAnimationFrame(() => {
				const target = document.querySelector<HTMLElement>(
					'[data-persona-form] [aria-invalid="true"]',
				)
				target?.scrollIntoView({ block: "center", behavior: "smooth" })
				target?.focus({ preventScroll: true })
			})
		} else if (result.kind === "conflict") {
			toast.warning(t("form.conflict"))
		} else if (result.kind === "failed") {
			toast.error(t("form.saveFailed"))
		} else if (result.kind === "saved") {
			toast.success(editing ? t("form.savedEdit") : t("form.saved"))
			onSaved(result.personaId)
			onOpenChange(false)
		}
	})

	return (
		<Dialog open={open} onOpenChange={(next) => !form.saving && onOpenChange(next)}>
			<DialogContent
				className={cn(
					"flex flex-col gap-0 overflow-hidden p-0",
					isMobile
						? "h-[100dvh] max-w-none rounded-none"
						: "h-[min(760px,calc(100vh-48px))] w-[min(920px,calc(100vw-32px))] max-w-none sm:max-w-none",
				)}
			>
				<div className="flex shrink-0 items-start gap-3 border-b border-border py-4 pl-6 pr-12">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<DialogTitle className="text-base">
							{editing ? t("form.editTitle") : t("form.createTitle")}
						</DialogTitle>
						<DialogDescription className="text-xs">
							{t("form.subtitle")}
						</DialogDescription>
					</div>
					{onSwitchToChat && !editing && !isMobile ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 gap-1 px-2 text-xs text-muted-foreground"
							onClick={onSwitchToChat}
						>
							<MessagesSquare className="size-3.5" />
							{t("form.switchToChat")}
						</Button>
					) : null}
				</div>

				<div className="flex min-h-0 flex-1">
					<ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
						<div className="px-6 py-2" data-persona-form>
							{SECTION_ORDER.map((key, index) => {
								const isOpen = form.sections[key]
								const missingCount = SECTION_FIELDS[key].filter((field) =>
									missing.includes(field),
								).length
								const filledCount = SECTION_FIELDS[key].filter((field) =>
									isFieldFilled(values, field),
								).length
								return (
									<section
										key={key}
										className="border-b border-border last:border-0"
									>
										<button
											type="button"
											aria-expanded={isOpen}
											onClick={() => form.toggleSection(key)}
											className="flex w-full items-center gap-3 rounded-md py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
												{index + 1}
											</span>
											<span className="min-w-0 flex-1">
												<span className="text-[13px] font-semibold">
													{sectionCopy[key].title}
												</span>
												<span className="ml-2 text-xs text-muted-foreground">
													{sectionCopy[key].hint}
												</span>
											</span>
											{missingCount > 0 ? (
												<span className="text-[11px] text-destructive">
													{t("form.missingCount", {
														count: missingCount,
													})}
												</span>
											) : !isOpen ? (
												<span className="text-[11px] text-muted-foreground">
													{filledCount > 0
														? t("form.filledCount", {
																count: filledCount,
															})
														: t("form.optional")}
												</span>
											) : null}
											<ChevronDown
												className={cn(
													"size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
													isOpen && "rotate-180",
												)}
											/>
										</button>
										{isOpen ? (
											<div className="pb-5 sm:pl-8">
												<PersonaFormSection
													section={key}
													values={values}
													missing={missing}
													setField={form.setField}
												/>
											</div>
										) : null}
									</section>
								)
							})}
						</div>
					</ScrollArea>

					{isMobile ? null : (
						<aside className="flex w-[300px] shrink-0 flex-col gap-4 border-l border-border bg-muted/30 p-5">
							<span className="text-xs font-medium text-muted-foreground">
								{t("form.preview")}
							</span>
							{/* Display only: the preview card is not a second way to open the persona. */}
							<div aria-hidden className="pointer-events-none">
								<PersonaCard persona={preview} onOpen={() => undefined} />
							</div>
							<div className="rounded-xl border border-border bg-background p-3.5">
								<div className="flex items-center justify-between text-xs">
									<span className="font-medium">{t("form.completeness")}</span>
									<span className="tabular-nums text-muted-foreground">
										{completeness}%
									</span>
								</div>
								<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-foreground/80 transition-[width] motion-reduce:transition-none"
										style={{ width: `${completeness}%` }}
									/>
								</div>
								<p className="mt-2.5 text-[11px] leading-5 text-muted-foreground">
									{t("form.requiredProgress", {
										done: requiredDone.length,
										total: REQUIRED_PERSONA_FIELDS.length,
									})}
									{suggestions.length
										? t("form.suggest", {
												fields: suggestions.slice(0, 3).join("、"),
											})
										: t("form.complete")}
								</p>
							</div>
							<p className="mt-auto flex gap-2 text-[11px] leading-5 text-muted-foreground">
								<Info className="mt-0.5 size-3.5 shrink-0" />
								{editing ? t("form.editNote") : t("form.manualNote")}
							</p>
						</aside>
					)}
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					{identifierLabels.length ? (
						<span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
							<ShieldAlert className="size-3.5 shrink-0" />
							{t("form.identifierWarning", { kinds: identifierLabels.join("、") })}
						</span>
					) : (
						<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
							{t("form.footer")}
						</span>
					)}
					<Button
						variant="outline"
						size="sm"
						disabled={form.saving}
						onClick={() => onOpenChange(false)}
					>
						{t("form.cancel")}
					</Button>
					{identifierLabels.length ? (
						<Button
							variant="outline"
							size="sm"
							disabled={form.saving}
							onClick={() => void submit(true)}
						>
							{t("form.saveAnyway")}
						</Button>
					) : null}
					<Button size="sm" disabled={form.saving} onClick={() => void submit(false)}>
						{form.saving ? <Spinner className="size-3.5" /> : null}
						{editing ? t("form.saveEdit") : t("form.save")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

import { Check, Loader2, MessageCircleQuestion, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import { resolvePhaseStatuses } from "../services/researchFiles"
import type { StudyFile, StudyPhaseKey, StudyPhaseStatus } from "../types"

interface StudyStepperProps {
	study: StudyFile | null
	compact?: boolean
	/** The agent is paused on ask_user; the running step shows "waiting for you". */
	waitingForUser?: boolean
	/** Jump to the output of a step (plan, desk research, interviews, report, questionnaire). */
	onStepClick?: (key: StudyPhaseKey) => void
}

/**
 * Six-step research progress driven by study.json.
 * Started steps are shortcuts to their outputs; pending steps only explain themselves.
 */
export default function StudyStepper({
	study,
	compact = false,
	waitingForUser = false,
	onStepClick,
}: StudyStepperProps) {
	const { t } = useTranslation("personaResearch")
	const labels: Record<StudyPhaseKey, { title: string; hint: string }> = {
		clarify: { title: t("phase.clarify"), hint: t("phaseHint.clarify") },
		plan: { title: t("phase.plan"), hint: t("phaseHint.plan") },
		desk_research: { title: t("phase.deskResearch"), hint: t("phaseHint.deskResearch") },
		interview: { title: t("phase.interview"), hint: t("phaseHint.interview") },
		report: { title: t("phase.report"), hint: t("phaseHint.report") },
		validation: {
			// After real answers are compared, the last step reports how many people confirmed it.
			title: study?.validated_count
				? t("phase.validatedCount", { count: study.validated_count })
				: t("phase.validation"),
			hint: t("phaseHint.validation"),
		},
	}
	const steps = resolvePhaseStatuses(study)

	return (
		<ol
			className={cn("flex w-full items-center", compact ? "gap-1" : "gap-1.5")}
			data-testid="persona-research-stepper"
		>
			{steps.map((step, index) => {
				const isWaiting = waitingForUser && step.status === "running"
				const clickable = Boolean(onStepClick) && step.status !== "pending"
				return (
					<li key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									aria-disabled={!clickable}
									onClick={() => clickable && onStepClick?.(step.key)}
									aria-current={step.status === "running" ? "step" : undefined}
									className={cn(
										"flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 outline-none transition-colors",
										"focus-visible:ring-2 focus-visible:ring-ring",
										clickable ? "hover:bg-accent" : "cursor-default",
									)}
								>
									<StepDot
										status={step.status}
										waiting={isWaiting}
										index={index}
									/>
									{compact ? null : (
										<span
											className={cn(
												"truncate text-xs",
												step.status === "running"
													? "font-medium text-foreground"
													: step.status === "done"
														? "text-foreground/80"
														: "text-muted-foreground",
											)}
										>
											{labels[step.key].title}
										</span>
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-56">
								<p className="font-medium">
									{labels[step.key].title}
									{isWaiting ? ` · ${t("status.waitingUser")}` : ""}
								</p>
								<p className="text-xs opacity-80">{labels[step.key].hint}</p>
							</TooltipContent>
						</Tooltip>
						{index < steps.length - 1 ? (
							<span className="relative h-px min-w-2 flex-1 overflow-hidden bg-border">
								{/* The connector fills left-to-right as a phase completes. */}
								<span
									className={cn(
										"absolute inset-y-0 left-0 bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none",
										step.status === "done" || step.status === "skipped"
											? "w-full"
											: "w-0",
									)}
								/>
							</span>
						) : null}
					</li>
				)
			})}
		</ol>
	)
}

/**
 * One step marker. `still` drops the spinner and ping on the running step, for snapshots such as
 * chat tool cards where the step was current at that moment but nothing is happening now.
 */
export function StepDot({
	status,
	waiting,
	index,
	still = false,
}: {
	status: StudyPhaseStatus
	waiting: boolean
	index: number
	still?: boolean
}) {
	const base =
		"flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors"
	if (waiting) {
		return (
			<span className={cn(base, "bg-amber-500 text-white")}>
				<MessageCircleQuestion className="size-3" />
			</span>
		)
	}
	if (status === "done") {
		return (
			<span className={cn(base, "bg-primary text-primary-foreground")}>
				<Check className="size-3" />
			</span>
		)
	}
	if (status === "running" && still) {
		return (
			<span className={cn(base, "border border-primary bg-primary/10 text-primary")}>
				{index + 1}
			</span>
		)
	}
	if (status === "running") {
		return (
			<span className={cn(base, "relative border border-primary text-primary")}>
				<span className="absolute inset-0 animate-ping rounded-full border border-primary/40 motion-reduce:animate-none" />
				<Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
			</span>
		)
	}
	if (status === "failed") {
		return (
			<span className={cn(base, "bg-destructive text-destructive-foreground")}>
				<X className="size-3" />
			</span>
		)
	}
	return (
		<span
			className={cn(
				base,
				"border border-border text-muted-foreground",
				status === "skipped" && "border-dashed",
			)}
		>
			{index + 1}
		</span>
	)
}

/** Six placeholder steps while study.json loads, so unfinished steps never flash as "0/6". */
export function StudyStepperSkeleton({ compact = false }: { compact?: boolean }) {
	return (
		<div className="flex items-center gap-3" aria-busy>
			{Array.from({ length: 6 }, (_, index) => (
				<div key={index} className="flex flex-1 items-center gap-2">
					<Skeleton className="size-5 shrink-0 rounded-full" />
					{compact ? null : <Skeleton className="h-3 w-14" />}
					{index < 5 ? <Skeleton className="h-px flex-1" /> : null}
				</div>
			))}
		</div>
	)
}

import type { ReactNode } from "react"
import { CircleHelp, PlayCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import { HelpIllustration } from "@/components/shadcn-composed/context-help/HelpIllustration"
import { Button } from "@/components/shadcn-ui/button"
import { DialogClose } from "@/components/shadcn-ui/dialog"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { requestResearchOnboarding, type ResearchOnboardingPage } from "./onboardingState"

/** The dialog's close animation and focus return finish before the tour measures the page. */
const REPLAY_DELAY = 250

/**
 * "使用说明" entry in the page bar: hover for a one-line summary, click for the full guide. Reuses
 * the app's context help so the dialog, focus handling and reading layout match other help.
 */
export default function ResearchHelp({
	page,
	className,
}: {
	page: ResearchOnboardingPage
	className?: string
}) {
	const { t } = useTranslation("personaResearch")
	const isMobile = useIsMobile()

	return (
		<ContextHelp
			mode="dialog"
			header={{
				title: t("onboarding.help.title"),
				description: t("onboarding.help.subtitle"),
			}}
			help={{
				title: t("onboarding.help.articleTitle"),
				summary: t("onboarding.help.summary"),
				tone: "neutral",
				renderBody: () => <ResearchHelpBody page={page} replay={!isMobile} />,
			}}
		>
			<Button
				variant="ghost"
				size="sm"
				className={cn(
					"h-8 shrink-0 gap-1.5 px-2 text-[13px] text-muted-foreground hover:text-foreground",
					className,
				)}
				aria-label={t("onboarding.help.label")}
			>
				<CircleHelp className="size-4" aria-hidden />
				{isMobile ? null : t("onboarding.help.label")}
			</Button>
		</ContextHelp>
	)
}

function ResearchHelpBody({ page, replay }: { page: ResearchOnboardingPage; replay: boolean }) {
	const { t } = useTranslation("personaResearch")
	// The six phases reuse the stepper's own names and hints so the guide never drifts from it.
	const phases = [
		{ title: t("phase.clarify"), description: t("phaseHint.clarify") },
		{ title: t("phase.deskResearch"), description: t("phaseHint.deskResearch") },
		{ title: t("phase.plan"), description: t("phaseHint.plan") },
		{ title: t("phase.interview"), description: t("phaseHint.interview") },
		{ title: t("phase.report"), description: t("phaseHint.report") },
		{ title: t("phase.validation"), description: t("phaseHint.validation") },
	]

	return (
		<article className="space-y-8">
			<p>{t("onboarding.help.intro")}</p>
			<aside className="rounded-r-xl border-l-[3px] border-[var(--help-accent)] bg-[var(--help-soft)] p-4 text-sm">
				{t("onboarding.help.simulated")}
			</aside>
			{replay ? (
				<DialogClose asChild>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() =>
							window.setTimeout(() => requestResearchOnboarding(page), REPLAY_DELAY)
						}
					>
						<PlayCircle className="size-4" aria-hidden />
						{page === "home"
							? t("onboarding.help.replayHome")
							: t("onboarding.help.replayStudio")}
					</Button>
				</DialogClose>
			) : null}
			<HelpIllustration
				title={t("onboarding.help.phasesTitle")}
				steps={phases}
				variant="flow"
			/>
			<HelpSection title={t("onboarding.help.settingsTitle")}>
				{t("onboarding.help.settings")}
			</HelpSection>
			<HelpSection title={t("onboarding.help.personasTitle")}>
				{t("onboarding.help.personas")}
			</HelpSection>
			<HelpSection title={t("onboarding.help.outputsTitle")}>
				{t("onboarding.help.outputs")}
			</HelpSection>
			<HelpSection title={t("onboarding.help.validationTitle")}>
				{t("onboarding.help.validation")}
			</HelpSection>
			<HelpSection title={t("onboarding.help.moreTitle")}>
				{t("onboarding.help.more")}
			</HelpSection>
		</article>
	)
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-2">
			<h3 className="text-lg font-semibold">{title}</h3>
			<p className="whitespace-pre-line text-muted-foreground">{children}</p>
		</section>
	)
}

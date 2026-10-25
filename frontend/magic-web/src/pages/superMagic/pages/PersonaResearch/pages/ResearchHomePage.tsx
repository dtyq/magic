import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useMemoizedFn, useSize } from "ahooks"
import {
	ArrowRight,
	ClipboardCheck,
	FolderClock,
	LayoutTemplate,
	ListChecks,
	Quote,
	UsersRound,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import MobileInputContainer from "@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { useResearchEditor } from "../hooks/useResearchEditor"
import { useResearchTemplates } from "../hooks/useResearchTemplates"
import { useSectionPins } from "../hooks/useSectionPins"
import { useStudyActions } from "../hooks/useStudyActions"
import PersonaAvatar from "../components/PersonaAvatar"
import ResearchHistoryFiles from "../components/ResearchHistoryFiles"
import ResearchComposerOptions, {
	type ReportTemplateOption,
} from "../components/ResearchComposerOptions"
import ResearchVoiceCard from "../components/ResearchVoiceCard"
import {
	DEFAULT_RESEARCH_OPTIONS,
	interviewDepth,
	parseResearchOptions,
	readSavedReportTemplate,
	researchSettingsLine,
	saveReportTemplateChoice,
	type ResearchOptions,
} from "../services/researchOptions"
import {
	DEFAULT_REPORT_TEMPLATE_PATH,
	getAttachmentPath,
	reportTemplateName,
} from "../services/researchFiles"
import SectionPinBars from "../components/SectionPinBars"
import SectionTitle from "../components/SectionTitle"
import StudyListSection from "../components/StudyListSection"
import StudyPersonaPicks from "../components/StudyPersonaPicks"
import ResearchOnboarding from "../onboarding/ResearchOnboarding"
import ResearchHelp from "../onboarding/ResearchHelp"
import { ResearchOnboardingAnchor } from "../onboarding/onboardingState"
import { PRESSABLE } from "../components/surface"

// Loaded only on mobile: the mobile shell pulls in the settings panel and its dependencies,
// which the desktop home never needs.
const MobileSidebarToggle = lazy(() =>
	import("@/pages/superMagicMobile/components/MobileShell/MobileShellSidebarToggleButton").then(
		(module) => ({ default: module.MobileShellSidebarToggleButton }),
	),
)
import styles from "./ResearchHomePage.module.css"

/** Research home: ask a business question, pick a template, or reopen a study. */
function ResearchHomePage() {
	const { t, i18n } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	// The voice card sits beside the composer only when both fit: the composer's settings row
	// needs about 540px next to the 380px card. Measured on the hero, not the viewport, because
	// side panels narrow the page; below it the hero is one column and the card is left out.
	const heroRef = useRef<HTMLElement>(null)
	const heroWidth = useSize(heroRef)?.width
	// English settings chips and labels are wider than the Chinese ones (about 680px against 540px),
	// so the card waits for a wider hero; otherwise the settings wrap onto a second line.
	const heroSplitMinWidth = i18n.language?.startsWith("zh")
		? HERO_SPLIT_MIN_WIDTH
		: HERO_SPLIT_MIN_WIDTH_WIDE_LABELS
	const heroSplit = !isMobile && (heroWidth === undefined || heroWidth >= heroSplitMinWidth)
	const templates = useResearchTemplates()
	const { openStudy, requestDelete, deleteDialog } = useStudyActions()
	// "历史产物" sidebar: the whole research project's files, opened from the top-right link.
	const [historyOpen, setHistoryOpen] = useState(false)
	const historyButtonRef = useRef<HTMLButtonElement>(null)
	const changeHistoryOpen = useMemoizedFn((next: boolean) => {
		setHistoryOpen(next)
		// The docked sidebar unmounts without a focus return of its own; hand focus back to the entry.
		if (!next) window.setTimeout(() => historyButtonRef.current?.focus(), 0)
	})

	// The home composer always starts a new study, never continues the last opened one.
	useEffect(() => {
		store.selectStudy(undefined)
	}, [store])

	// Study settings beside the composer; remembered per browser as a convenience only.
	const [options, setOptions] = useState<ResearchOptions>(readSavedOptions)
	const updateOptions = useMemoizedFn((next: ResearchOptions) => {
		setOptions(next)
		try {
			localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(next))
		} catch {
			// Storage can be unavailable (private mode); the settings still apply to this send.
		}
	})

	// Report template for new studies. The default (null) is left to the agent; a remembered
	// template that has since been deleted falls back to it.
	const [savedTemplate, setSavedTemplate] = useState(readSavedReportTemplate)
	const templateChoices = store.reportTemplates
		.map((item) => getAttachmentPath(item))
		.filter((path) => path !== DEFAULT_REPORT_TEMPLATE_PATH)
		.map((path) => ({ path, label: reportTemplateName(path) }))
	const reportTemplate = templateChoices.some((item) => item.path === savedTemplate)
		? savedTemplate
		: null
	const openTemplates = useMemoizedFn(() =>
		navigate({ name: RouteName.PersonaResearchTemplates }),
	)
	const reportTemplateOption: ReportTemplateOption = {
		value: reportTemplate,
		templates: templateChoices,
		onChange: (path) => {
			setSavedTemplate(path)
			saveReportTemplateChoice(path)
		},
		onManage: openTemplates,
	}

	const { editorContext, editorNodes, fillComposer } = useResearchEditor({
		variant: isMobile ? "mobile" : "desktop",
		selectedTopic: null,
		showLoading: false,
		messagesLength: 0,
		// The picks belong to the study just sent; a failed send never gets here and keeps them.
		onStudyStarted: useMemoizedFn((topic: Topic) => {
			store.clearStudyPersonaPicks()
			openStudy(topic)
		}),
		// Fixed settings travel as one 【研究设置】 line at the end of the first message.
		appendToMessage: useMemoizedFn(() =>
			researchSettingsLine(options, {
				reportTemplatePath: reportTemplate,
				personaPaths: store.studyPersonaPicks.map((pick) => pick.path),
			}),
		),
		bareContainer: true,
	})

	/** Templates sit below the fold on small screens; bring the composer back into view. */
	const applyStarter = useMemoizedFn((prompt: string, preset?: ResearchOptions) => {
		fillComposer(prompt)
		if (preset) updateOptions(preset)
		document
			.querySelector('[data-testid="persona-research-composer"]')
			?.scrollIntoView({ behavior: "smooth", block: "center" })
	})

	const libraryPersonas = store.personas.map((ref) => ref.data)
	const openLibrary = useMemoizedFn(() => navigate({ name: RouteName.PersonaResearchPersonas }))
	// The home tour ends on its "start a study" action: put the cursor where the question goes.
	const focusComposer = useMemoizedFn(() => {
		document
			.querySelector<HTMLElement>(
				'[data-testid="persona-research-composer"] [contenteditable="true"]',
			)
			?.focus()
	})

	// Phones: the section headings pin to the screen edges (passed ones on top, upcoming ones at the
	// bottom) and a tap jumps to the section, so a long page needs no hunting by scrolling.
	const scrollerRef = useRef<HTMLDivElement>(null)
	const studyCount = store.studies.length
	const pinSections = useMemo(
		() => [
			{ id: "templates", title: t("home.templatesTitle") },
			{
				id: "studies",
				title: t("home.myStudies"),
				hint: studyCount > 0 ? t("home.studiesCount", { count: studyCount }) : undefined,
			},
		],
		[studyCount, t],
	)
	const { positions: pinPositions, jump: jumpToSection } = useSectionPins(
		scrollerRef,
		pinSections,
		isMobile,
	)

	return (
		// The sidebar docks beside the page, so the page keeps its own scroll area.
		<ResearchHistoryFiles open={historyOpen} onOpenChange={changeHistoryOpen}>
			<div className="relative h-full min-h-0">
				<ScrollArea
					className="h-full bg-background"
					viewportClassName="[&>div]:!block"
					viewportRef={scrollerRef}
					data-testid="persona-research-home"
				>
					<div
						className={cn(
							"mx-auto flex w-full max-w-6xl flex-col",
							isMobile ? "gap-8 px-4 pb-6 pt-3" : "gap-14 px-10 pb-16 pt-5",
						)}
					>
						{/* No page bar: the sidebar already names the page. Help, the persona library and
				    report templates sit as quiet links at the top right, above the hero. */}
						<div className={cn("flex flex-col", isMobile ? "gap-2" : "gap-3")}>
							<div
								// flex-wrap: the row (sidebar button, help and three links) is wider than a 320px screen.
								className={cn(
									"flex flex-wrap items-center justify-end gap-1",
									styles.enter,
								)}
								style={enterDelay(0)}
							>
								{/* The sidebar lives in the mobile shell drawer; this is the only way to open it here. */}
								{isMobile ? (
									// The fallback keeps the row height and the right-aligned links in place.
									<Suspense
										fallback={<span className="mr-auto size-10" aria-hidden />}
									>
										<MobileSidebarToggle
											variant="floating"
											className="mr-auto size-10"
										/>
									</Suspense>
								) : null}
								<ResearchHelp page="home" />
								<button
									type="button"
									data-guide-anchor={ResearchOnboardingAnchor.HomePersonaLibrary}
									// The text label is hidden on the narrowest phones, so the name moves to the button.
									aria-label={t("home.personaLibraryLabel")}
									className={cn(HOME_LINK, PRESSABLE)}
									onClick={openLibrary}
								>
									<span className="flex -space-x-1.5">
										{libraryPersonas.slice(0, 3).map((persona) => (
											<PersonaAvatar
												key={persona.id}
												id={persona.id}
												name={persona.name}
												className="size-5 ring-2 ring-background"
											/>
										))}
										{libraryPersonas.length === 0 ? (
											<UsersRound className="size-4" />
										) : null}
									</span>
									{/* Hidden below 390px (English "Persona library" is wider than the Chinese label) so the five top links stay on one row. */}
									<span className="max-[389px]:hidden">
										{t("home.personaLibraryLabel")}
									</span>
									{/* Counted from the file list: the home reads only a few preview personas. */}
									<span className="font-mono text-xs opacity-70">
										{store.personaFileCount}
									</span>
								</button>
								<button
									type="button"
									className={cn(HOME_LINK, PRESSABLE)}
									aria-label={t("home.reportTemplatesLabel")}
									onClick={openTemplates}
								>
									<LayoutTemplate className="size-4" />
									{isMobile ? null : t("home.reportTemplatesLabel")}
									<span className="font-mono text-xs opacity-70">
										{store.reportTemplates.length}
									</span>
								</button>
								<button
									ref={historyButtonRef}
									type="button"
									className={cn(
										HOME_LINK,
										PRESSABLE,
										historyOpen && "bg-muted text-foreground",
									)}
									aria-label={t("home.historyFilesLabel")}
									aria-expanded={historyOpen}
									onClick={() => changeHistoryOpen(!historyOpen)}
								>
									<FolderClock className="size-4" />
									{isMobile ? null : t("home.historyFilesLabel")}
								</button>
							</div>
							{/* Hero: the question on the left, a persona voice on the right when there is room. */}
							<section
								ref={heroRef}
								className={cn(
									"grid items-stretch",
									heroSplit
										? "grid-cols-[minmax(0,1fr)_380px] gap-12"
										: "grid-cols-1 gap-6",
								)}
							>
								<div className="flex min-w-0 flex-col">
									<h1
										className={cn(
											"font-black tracking-[-0.035em] text-foreground",
											// Leading goes with the size: cn() drops a leading class placed before a text size.
											isMobile
												? // On ~320px phones the second line (9 characters at 36px) would wrap and
													// leave a lone character; 30px keeps both lines whole.
													"text-4xl leading-[1.15] max-[365px]:text-3xl"
												: "text-[64px] leading-[1.08]",
										)}
									>
										{/* Each line of the title rises on its own, the second a beat later. */}
										{t("home.title")
											.split("\n")
											.map((line, index) => (
												<span
													key={index}
													className={cn("block", styles.enter)}
													style={enterDelay(index * 60)}
												>
													{line}
												</span>
											))}
									</h1>
									<p
										className={cn(
											"mt-3 max-w-[30em] text-[15px] leading-7 text-muted-foreground",
											styles.enter,
										)}
										style={enterDelay(120)}
									>
										{t("home.subtitle")}
									</p>
									<div
										className={cn(
											"mt-6 rounded-2xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.14)] ring-1 ring-border transition-shadow focus-within:shadow-[0_10px_30px_-12px_rgb(0_0_0/0.24)] focus-within:ring-foreground/30",
											// The phone composer is a bottom dock: a grey band (square corners that poke out of
											// this rounded card) around a white shadowed pill. Flatten both so the input and the
											// settings below read as one surface. Tied to the dock's markup in MobileComposer.
											isMobile &&
												"[&>div:first-child>.rounded-3xl]:!bg-transparent [&>div:first-child>.rounded-3xl]:!shadow-none [&>div:first-child>.rounded-3xl]:!ring-0 [&>div:first-child]:!bg-transparent [&>div:first-child]:!p-0 [&_[data-testid=mobile-composer-header]]:px-3 [&_[data-testid=mobile-composer-header]]:pt-2.5",
											styles.enter,
										)}
										style={enterDelay(170)}
										data-testid="persona-research-composer"
										data-guide-anchor={ResearchOnboardingAnchor.HomeComposer}
									>
										{isMobile ? (
											<MobileInputContainer
												editorContext={editorContext}
												editorNodes={editorNodes}
											/>
										) : (
											<DefaultMessageEditorContainer
												editorContext={editorContext}
												editorNodes={editorNodes}
											/>
										)}
										{/* Settings strip inside the composer box, as in the prototype's bottom bar. */}
										<ResearchComposerOptions
											value={options}
											onChange={updateOptions}
											reportTemplate={reportTemplateOption}
											guideAnchor={ResearchOnboardingAnchor.HomeSettings}
											// Phones: a tidy two-column grid of tiles under a hairline, left edge in line
											// with the text above, instead of ragged wrapped chips.
											className={cn(
												isMobile
													? "grid grid-cols-2 gap-2 border-t border-border px-4 pb-4 pt-3"
													: "px-2.5 pb-3 pt-1.5",
											)}
											pickedCount={store.studyPersonaPicks.length}
											trailing={
												isMobile ? (
													<div className="col-span-2">
														<StudyPersonaPicks
															onPickMore={openLibrary}
															fullWidth
														/>
													</div>
												) : (
													<StudyPersonaPicks onPickMore={openLibrary} />
												)
											}
										/>
									</div>
									{/* What every study promises, in place of decorative value-prop tiles. Phones get a small
								    grouped list; three loose grey lines under the card looked unfinished. */}
									<div
										className={cn(
											isMobile
												? "mt-3 flex flex-col rounded-xl bg-muted/40 px-3.5 text-[13px] text-foreground/75 [&>span:not(:last-child)]:border-b [&>span:not(:last-child)]:border-border/60 [&>span]:py-2.5"
												: "mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground",
											styles.enter,
										)}
										style={enterDelay(220)}
									>
										<span
											className={cn(
												"inline-flex items-center",
												isMobile ? "gap-2.5" : "gap-1.5",
											)}
										>
											<ListChecks className="size-3.5" />
											{t("home.promise.clarify")}
										</span>
										<span
											className={cn(
												"inline-flex items-center",
												isMobile ? "gap-2.5" : "gap-1.5",
											)}
										>
											<Quote className="size-3.5" />
											{t("home.promise.quotes")}
										</span>
										<span
											className={cn(
												"inline-flex items-center",
												isMobile ? "gap-2.5" : "gap-1.5",
											)}
										>
											<ClipboardCheck className="size-3.5" />
											{t("home.promise.validate")}
										</span>
									</div>
								</div>
								{heroSplit ? (
									<div
										className={cn("flex", styles.enter, styles.enterSoft)}
										style={enterDelay(200)}
									>
										<ResearchVoiceCard
											personas={libraryPersonas}
											onOpenLibrary={openLibrary}
											className="flex-1"
										/>
									</div>
								) : null}
							</section>
						</div>

						<section
							className="flex flex-col gap-4"
							data-guide-anchor={ResearchOnboardingAnchor.HomeTemplates}
						>
							<div
								className={styles.enter}
								style={enterDelay(230)}
								data-pin-id="templates"
							>
								<SectionTitle
									title={t("home.templatesTitle")}
									hint={t("home.templatesHint")}
								/>
							</div>
							<div
								className={cn(
									"grid gap-3",
									isMobile
										? "grid-cols-1"
										: "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]",
								)}
							>
								{templates.map(
									(
										{
											id,
											kicker,
											method,
											title,
											description,
											prompt,
											options: preset,
											image,
										},
										index,
									) => (
										<button
											key={id}
											type="button"
											// Cards follow the hero one after another, all in within ~0.7s.
											style={enterDelay(260 + index * TEMPLATE_STAGGER_MS)}
											className={cn(
												styles.enter,
												"group flex flex-col overflow-hidden rounded-xl bg-card text-left outline-none ring-1 ring-border",
												"transition-all duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:shadow-[0_6px_18px_-10px_rgb(0_0_0/0.3)] active:scale-[0.98]",
												"focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none",
											)}
											onClick={() => applyStarter(prompt, preset)}
										>
											{/* Scene photo: what the study is about. It fades into the card so the text below
									    stays the focus; a slow zoom on hover is the only motion. */}
											<span className="relative block h-28 overflow-hidden bg-muted">
												<img
													src={image}
													alt=""
													loading="lazy"
													className="size-full object-cover saturate-[0.88] transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
												/>
												<span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
											</span>
											<span className="flex flex-1 flex-col gap-1.5 px-[18px] pb-[18px] pt-2">
												<span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
													{kicker}
												</span>
												<span className="text-[15px] font-bold text-foreground">
													{title}
												</span>
												<span className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">
													{description}
												</span>
												<span className="mt-auto flex items-center gap-1 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
													<span className="truncate">
														{[
															preset?.panelSize &&
															preset.panelSize !== "auto"
																? t("options.panelValue", {
																		count: preset.panelSize,
																	})
																: null,
															preset?.rounds &&
															preset.rounds !== "auto"
																? {
																		quick: t(
																			"options.depthQuick",
																		),
																		standard:
																			t(
																				"options.depthStandard",
																			),
																		deep: t(
																			"options.depthDeep",
																		),
																	}[interviewDepth(preset.rounds)]
																: null,
															method,
														]
															.filter(Boolean)
															.join(" · ")}
													</span>
													<ArrowRight className="ml-auto size-3.5 shrink-0 opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />
												</span>
											</span>
										</button>
									),
								)}
							</div>
						</section>

						<StudyListSection
							stickyHeader={!isMobile}
							onOpen={openStudy}
							onDelete={requestDelete}
							onTrySample={() => applyStarter(t("home.samplePrompt"))}
							onViewAll={() => navigate({ name: RouteName.PersonaResearchStudies })}
						/>
					</div>

					{deleteDialog}
					{/* The page is fully rendered once the shell shows it (the store loads before). */}
					<ResearchOnboarding page="home" ready onFinish={focusComposer} />
				</ScrollArea>
				{isMobile ? (
					<SectionPinBars
						sections={pinSections}
						positions={pinPositions}
						onJump={jumpToSection}
					/>
				) : null}
			</div>
		</ResearchHistoryFiles>
	)
}

/** Quiet top-right links (help, persona library, report templates) in place of a page bar. */
const HOME_LINK =
	"flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"

/** Gap between template cards as they enter; six cards finish well under a second. */
const TEMPLATE_STAGGER_MS = 40

/** Inline delay for the one-time entrance animation (see ResearchHomePage.module.css). */
function enterDelay(ms: number): CSSProperties {
	return { "--enter-delay": `${ms}ms` } as CSSProperties
}

/** Hero width that fits the 380px voice card, a 48px gap and a ~540px composer. */
const HERO_SPLIT_MIN_WIDTH = 968
/** Same, for languages whose setting labels are longer than the Chinese ones (English). */
const HERO_SPLIT_MIN_WIDTH_WIDE_LABELS = 1110

const OPTIONS_STORAGE_KEY = "persona-research:composer-options"

function readSavedOptions(): ResearchOptions {
	try {
		const raw = localStorage.getItem(OPTIONS_STORAGE_KEY)
		return raw ? parseResearchOptions(JSON.parse(raw)) : DEFAULT_RESEARCH_OPTIONS
	} catch {
		return DEFAULT_RESEARCH_OPTIONS
	}
}

export default observer(ResearchHomePage)

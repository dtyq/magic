import {
	forwardRef,
	useLayoutEffect,
	useRef,
	useState,
	type ComponentPropsWithoutRef,
	type KeyboardEvent,
	type ReactNode,
} from "react"
import { useSize } from "ahooks"
import {
	Check,
	ChevronDown,
	PencilLine,
	FlaskConical,
	LayoutTemplate,
	Repeat,
	Settings2,
	UsersRound,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Button } from "@/components/shadcn-ui/button"
import { ActionDrawer, ActionGroup, ActionItem } from "@/components/shadcn-composed/action-drawer"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import {
	CUSTOM_METHOD_MAX_LENGTH,
	effectivePanelSize,
	interviewDepth,
	normalizeCustomMethod,
	PANEL_SIZE_RANGE,
	PANEL_SIZES,
	parseWholeNumber,
	RESEARCH_METHODS,
	ROUND_COUNTS,
	type ResearchOptions,
} from "../services/researchOptions"
import { PRESSABLE } from "./surface"

/**
 * Row width (padding included) below which the "· Auto" suffix is never shown. Between this and
 * the width the chips really need, the row is measured: if it wraps (the trailing action drops to
 * a line of its own), the suffix is dropped for that width and tried again once the row is wider.
 * Measuring beats a fixed number: the need changes with the language, the font and the trailing
 * action (the picked-persona chip is wider than "pick from the library").
 */
const AUTO_SUFFIX_MIN_WIDTH = 640

/** Report template choice; `value` null is the default template. */
export interface ReportTemplateOption {
	value: string | null
	templates: { path: string; label: string }[]
	onChange: (path: string | null) => void
	onManage: () => void
}

interface ResearchComposerOptionsProps {
	value: ResearchOptions
	onChange: (value: ResearchOptions) => void
	reportTemplate?: ReportTemplateOption
	/** Extra controls after the three settings, e.g. "pick from the persona library". */
	trailing?: ReactNode
	className?: string
	/** `data-guide-anchor` for the research onboarding; only the home composer passes one. */
	guideAnchor?: string
	/** Personas picked for this study; the panel chip never shows fewer interviewees. */
	pickedCount?: number
}

/**
 * Study settings beside the composer: method, panel size, interview depth and, on the home,
 * the report template. "Auto" leaves the choice to the AI researcher; a fixed value, preset or
 * typed in under "Custom", is sent with the first message and shown on its chip.
 */
export default function ResearchComposerOptions({
	value,
	onChange,
	reportTemplate,
	trailing,
	className,
	guideAnchor,
	pickedCount = 0,
}: ResearchComposerOptionsProps) {
	const { t } = useTranslation("personaResearch")
	const methodLabel: Record<(typeof RESEARCH_METHODS)[number], string> = {
		auto: t("options.auto"),
		user_research: t("studyType.userResearch"),
		product_rnd: t("studyType.productRnd"),
		concept_test: t("studyType.conceptTest"),
		fast_insight: t("studyType.fastInsight"),
	}
	const panelLabel = (size: number) => t("options.panelValue", { count: size })
	const depthLabels = {
		quick: t("options.depthQuick"),
		standard: t("options.depthStandard"),
		deep: t("options.depthDeep"),
	}
	const roundsLabel = (rounds: number) => depthLabels[interviewDepth(rounds)]
	const isPresetPanel = (PANEL_SIZES as readonly unknown[]).includes(value.panelSize)
	const rowRef = useRef<HTMLDivElement>(null)
	const rowSize = useSize(rowRef)
	const rowWidth = rowSize?.width
	// Widest row at which the suffix was seen to wrap the row; the suffix stays off up to it.
	const [autoWrapsAtWidth, setAutoWrapsAtWidth] = useState(0)
	const showAuto =
		(rowWidth ?? AUTO_SUFFIX_MIN_WIDTH) >= AUTO_SUFFIX_MIN_WIDTH &&
		(rowWidth ?? Number.POSITIVE_INFINITY) > autoWrapsAtWidth

	// A different trailing chip (library prompt vs picked avatars) has a different width.
	useLayoutEffect(() => setAutoWrapsAtWidth(0), [pickedCount])

	useLayoutEffect(() => {
		const row = rowRef.current
		if (!row || !showAuto || !rowWidth) return
		const first = row.firstElementChild as HTMLElement | null
		if (!first) return
		const wrapped = Array.from(row.children).some(
			(child) => (child as HTMLElement).offsetTop - first.offsetTop > first.offsetHeight / 2,
		)
		if (wrapped) setAutoWrapsAtWidth(rowWidth)
	}, [showAuto, rowWidth, pickedCount, value])

	return (
		<div
			ref={rowRef}
			className={cn("flex flex-wrap items-center gap-2", className)}
			data-guide-anchor={guideAnchor}
		>
			<OptionMenu
				icon={<FlaskConical className="size-3.5" />}
				label={t("options.method")}
				showAuto={showAuto}
				valueLabel={
					value.method === "custom"
						? (value.customMethod ?? "")
						: methodLabel[value.method]
				}
				active={value.method !== "auto"}
				items={RESEARCH_METHODS.map((method) => ({
					key: method,
					label: methodLabel[method],
					selected: value.method === method,
					onSelect: () => onChange({ ...value, method, customMethod: undefined }),
				}))}
				custom={{
					selected: value.method === "custom",
					current: value.method === "custom" ? value.customMethod : undefined,
					placeholder: t("options.methodCustomPlaceholder"),
					maxLength: CUSTOM_METHOD_MAX_LENGTH,
					validate: () => null,
					onCommit: (draft) => {
						const customMethod = normalizeCustomMethod(draft)
						if (customMethod) onChange({ ...value, method: "custom", customMethod })
					},
				}}
			/>
			<OptionMenu
				icon={<UsersRound className="size-3.5" />}
				label={t("options.panel")}
				showAuto={showAuto}
				// Picked personas set a floor: a smaller fixed size is sent (and shown) as their number.
				valueLabel={
					value.panelSize !== "auto"
						? panelLabel(Number(effectivePanelSize(value.panelSize, pickedCount)))
						: pickedCount
							? t("options.panelWithPicks", { count: pickedCount })
							: t("options.auto")
				}
				active={value.panelSize !== "auto" || pickedCount > 0}
				items={PANEL_SIZES.map((size) => ({
					key: String(size),
					label: size === "auto" ? t("options.autoPanel") : panelLabel(size),
					selected: value.panelSize === size,
					onSelect: () => onChange({ ...value, panelSize: size }),
				}))}
				custom={{
					selected: !isPresetPanel,
					current:
						!isPresetPanel && value.panelSize !== "auto"
							? panelLabel(value.panelSize)
							: undefined,
					numeric: true,
					placeholder: t("options.customRange", PANEL_SIZE_RANGE),
					validate: (draft) =>
						parseWholeNumber(draft, PANEL_SIZE_RANGE) === null
							? t("options.panelRangeError", PANEL_SIZE_RANGE)
							: null,
					onCommit: (draft) => {
						const panelSize = parseWholeNumber(draft, PANEL_SIZE_RANGE)
						if (panelSize !== null) onChange({ ...value, panelSize })
					},
				}}
			/>
			<OptionMenu
				icon={<Repeat className="size-3.5" />}
				label={t("options.rounds")}
				showAuto={showAuto}
				title={t("options.roundsTitle")}
				description={t("options.roundsHelp")}
				valueLabel={value.rounds === "auto" ? t("options.auto") : roundsLabel(value.rounds)}
				active={value.rounds !== "auto"}
				items={ROUND_COUNTS.map((rounds) => ({
					key: String(rounds),
					label: rounds === "auto" ? t("options.autoRounds") : roundsLabel(rounds),
					selected:
						rounds === "auto"
							? value.rounds === "auto"
							: value.rounds !== "auto" &&
								interviewDepth(value.rounds) === interviewDepth(rounds),
					onSelect: () => onChange({ ...value, rounds }),
				}))}
			/>
			{reportTemplate ? (
				<OptionMenu
					icon={<LayoutTemplate className="size-3.5" />}
					label={t("options.reportTemplate")}
					valueLabel={
						reportTemplate.templates.find((item) => item.path === reportTemplate.value)
							?.label ?? t("options.reportTemplateDefault")
					}
					active={reportTemplate.value !== null}
					items={[
						{
							key: "default",
							label: t("options.reportTemplateDefault"),
							selected: reportTemplate.value === null,
							onSelect: () => reportTemplate.onChange(null),
						},
						...reportTemplate.templates.map((item) => ({
							key: item.path,
							label: item.label,
							selected: reportTemplate.value === item.path,
							onSelect: () => reportTemplate.onChange(item.path),
						})),
					]}
					footer={{
						icon: <Settings2 className="size-4" />,
						label: t("options.manageReportTemplates"),
						onSelect: reportTemplate.onManage,
					}}
				/>
			) : null}
			{trailing}
		</div>
	)
}

interface OptionItem {
	key: string
	label: string
	selected: boolean
	onSelect: () => void
}

/** "Custom" entry under the presets: a small input inside the menu, applied on Enter. */
interface CustomEntry {
	/** The current value is custom (not a preset and not auto). */
	selected: boolean
	/** Current custom value as shown beside "Custom", e.g. "9 人". */
	current?: string
	numeric?: boolean
	placeholder: string
	maxLength?: number
	/** Error text for a non-empty draft, null when it can be applied. */
	validate: (draft: string) => string | null
	onCommit: (draft: string) => void
}

/** Quiet chip inside the composer; forwards props and ref so a menu trigger can wrap it. */
const OptionChip = forwardRef<
	HTMLButtonElement,
	{
		icon: ReactNode
		label: string
		valueLabel: string
		active: boolean
		showAuto: boolean
		/**
		 * Phones show each setting as a tile (name above, current value below) that fills its grid
		 * cell: a bare "Report" or "User research" chip does not say which setting it is.
		 */
		tile?: boolean
	} & ComponentPropsWithoutRef<"button">
>(function OptionChip({ icon, label, valueLabel, active, showAuto, tile, ...buttonProps }, ref) {
	const { t } = useTranslation("personaResearch")
	if (tile) {
		return (
			<button
				ref={ref}
				type="button"
				aria-label={`${label}: ${valueLabel}`}
				{...buttonProps}
				className={cn(
					"flex h-14 w-full min-w-0 flex-col justify-center gap-0.5 rounded-xl bg-muted/60 px-3 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/25 max-[340px]:px-2.5",
					PRESSABLE,
				)}
			>
				<span className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground [&_svg]:size-3">
					{icon}
					<span className="truncate">{label}</span>
				</span>
				<span className="flex items-center gap-1">
					<span
						className={cn(
							"min-w-0 flex-1 truncate text-[13px] leading-5",
							// "Auto" is the unset state: quieter than a value the user picked.
							active ? "font-medium text-foreground" : "text-muted-foreground",
						)}
					>
						{valueLabel}
					</span>
					{/* Dropped on ~320px phones so the value gets the width. */}
					<ChevronDown className="size-3.5 shrink-0 opacity-60 max-[340px]:hidden" />
				</span>
			</button>
		)
	}
	return (
		<button
			ref={ref}
			type="button"
			aria-label={`${label}: ${valueLabel}`}
			{...buttonProps}
			className={cn(
				// Quiet chips inside the composer; a fixed value gets a soft fill, not solid ink.
				// Inset focus ring so a focused chip never paints over its neighbour.
				"inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground/25",
				active
					? "bg-muted text-foreground"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
				PRESSABLE,
			)}
		>
			{icon}
			{/* Short chips so all settings fit one row: the value alone once it is set,
			    else the setting's name, plus "· Auto" where there is room. */}
			<span className={cn("max-w-[10em] truncate", active && "font-medium")}>
				{active ? valueLabel : label}
			</span>
			{!active && showAuto ? <span className="opacity-70">· {t("options.auto")}</span> : null}
			<ChevronDown className="size-3.5 opacity-60" />
		</button>
	)
})

function OptionMenu({
	icon,
	label,
	title = label,
	showAuto = false,
	description,
	valueLabel,
	active,
	items,
	custom,
	footer,
}: {
	icon: ReactNode
	label: string
	/** Menu heading when the chip's short label is not enough, e.g. "rounds per interviewee". */
	title?: string
	/** One quiet line under the heading that explains the setting. */
	description?: string
	valueLabel: string
	active: boolean
	/** Unset chips read "Method · Auto" so "auto" is not mistaken for a missing value. */
	showAuto?: boolean
	items: OptionItem[]
	custom?: CustomEntry
	/** A link-like action under the choices, e.g. "manage templates". */
	footer?: { icon: ReactNode; label: string; onSelect: () => void }
}) {
	const { t } = useTranslation("personaResearch")
	const isMobile = useIsMobile()
	const [open, setOpen] = useState(false)
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState("")
	const trimmed = draft.trim()
	const error = custom && trimmed ? custom.validate(trimmed) : null
	const canApply = Boolean(custom && trimmed && !error)

	const onOpenChange = (next: boolean) => {
		setOpen(next)
		if (!next) setEditing(false)
	}
	const startEditing = () => {
		setDraft(custom?.selected && !custom.numeric ? (custom.current ?? "") : "")
		setEditing(true)
	}
	const apply = () => {
		if (!custom || !canApply) return
		custom.onCommit(trimmed)
		onOpenChange(false)
	}
	const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		// Keep typing in the input: the menu would otherwise treat keys as typeahead or navigation.
		event.stopPropagation()
		if (event.nativeEvent.isComposing) return
		if (event.key === "Enter") {
			event.preventDefault()
			apply()
		} else if (event.key === "Escape") {
			event.preventDefault()
			setEditing(false)
		}
	}
	const customLabel =
		custom?.selected && custom.current
			? t("options.customValue", { value: custom.current })
			: t("options.custom")
	// The input that replaces the "Custom" row; phones get a taller field and 16px text so iOS
	// does not zoom the page when it takes focus.
	const customEditor = custom ? (
		<div className={cn("flex flex-col gap-1.5", isMobile ? "p-2" : "px-2 pb-1.5 pt-1")}>
			<div className="flex items-center gap-1.5">
				<Input
					autoFocus
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onInputKeyDown}
					inputMode={custom.numeric ? "numeric" : "text"}
					maxLength={custom.maxLength}
					placeholder={custom.placeholder}
					aria-label={title}
					aria-invalid={Boolean(error)}
					className={isMobile ? "h-10 text-base" : "h-8 text-xs"}
				/>
				<Button
					size="sm"
					className={isMobile ? "h-10 px-3" : "h-8 px-2.5"}
					disabled={!canApply}
					onClick={apply}
				>
					{t("options.customApply")}
				</Button>
			</div>
			{error ? (
				<span className="text-[11px] text-destructive" role="alert">
					{error}
				</span>
			) : null}
		</div>
	) : null

	if (isMobile) {
		// Phones pick from a bottom sheet: a dropdown anchored to a small chip is hard to hit and
		// can run off the screen edge.
		const choose = (onSelect: () => void) => {
			onSelect()
			onOpenChange(false)
		}
		return (
			<>
				<OptionChip
					icon={icon}
					label={label}
					valueLabel={valueLabel}
					active={active}
					showAuto={showAuto}
					tile
					onClick={() => onOpenChange(true)}
				/>
				<ActionDrawer
					open={open}
					onOpenChange={onOpenChange}
					title={title}
					showCancel={false}
				>
					{description ? (
						<p className="px-1 text-xs leading-relaxed text-muted-foreground">
							{description}
						</p>
					) : null}
					<ActionGroup>
						{items.map((item) => (
							<ActionItem
								key={item.key}
								className="h-11"
								label={
									<span className="flex items-center gap-2">
										<span className="flex-1">{item.label}</span>
										{item.selected ? <Check className="size-4" /> : null}
									</span>
								}
								onClick={() => choose(item.onSelect)}
							/>
						))}
						{custom ? (
							editing ? (
								customEditor
							) : (
								<ActionItem
									className="h-11"
									icon={<PencilLine className="text-muted-foreground" />}
									label={
										<span className="flex items-center gap-2">
											<span className="flex-1 truncate">{customLabel}</span>
											{custom.selected ? <Check className="size-4" /> : null}
										</span>
									}
									onClick={startEditing}
								/>
							)
						) : null}
					</ActionGroup>
					{footer ? (
						<ActionGroup>
							<ActionItem
								className="h-11 text-muted-foreground"
								icon={footer.icon}
								label={footer.label}
								onClick={() => choose(footer.onSelect)}
							/>
						</ActionGroup>
					) : null}
				</ActionDrawer>
			</>
		)
	}

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger asChild>
				<OptionChip
					icon={icon}
					label={label}
					valueLabel={valueLabel}
					active={active}
					showAuto={showAuto}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className={cn("min-w-40", (custom || description) && "w-64")}
			>
				<DropdownMenuLabel className="flex flex-col gap-0.5 text-xs font-normal">
					<span className="text-muted-foreground">{title}</span>
					{description ? (
						<span className="leading-relaxed text-muted-foreground/80">
							{description}
						</span>
					) : null}
				</DropdownMenuLabel>
				{items.map((item) => (
					<DropdownMenuItem key={item.key} onSelect={item.onSelect}>
						<span className="flex-1">{item.label}</span>
						{item.selected ? <Check className="size-4" /> : null}
					</DropdownMenuItem>
				))}
				{custom ? (
					editing ? (
						customEditor
					) : (
						<DropdownMenuItem
							onSelect={(event) => {
								// Stay open: the input replaces this row.
								event.preventDefault()
								startEditing()
							}}
						>
							<PencilLine className="size-4 text-muted-foreground" />
							<span className="flex-1 truncate">{customLabel}</span>
							{custom.selected ? <Check className="size-4" /> : null}
						</DropdownMenuItem>
					)
				) : null}
				{footer ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-muted-foreground"
							onSelect={footer.onSelect}
						>
							{footer.icon}
							{footer.label}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

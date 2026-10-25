import { useMemo, useState, type ComponentType, type SVGProps } from "react"
import { useTranslation } from "react-i18next"
import {
	ChartNoAxesCombined,
	ChevronRight,
	CircleHelp,
	Database,
	Gauge,
	LayoutPanelTop,
	MousePointerClick,
	Palette,
	Save,
	ShieldCheck,
	Sparkles,
} from "lucide-react"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { cn } from "@/utils/cn"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

import {
	buildMicroAppIssuePrompt,
	microAppIssuePromptData,
	resolveMicroAppIssueLocale,
	searchMicroAppIssuePrompts,
	type MicroAppIssuePrompt,
} from "./microAppIssuePrompts"

type IssuePromptPanelVariant = "desktop" | "mobile"
type CategoryIcon = ComponentType<SVGProps<SVGSVGElement>>

interface MicroAppIssuePromptPanelProps {
	variant: IssuePromptPanelVariant
}

const FEATURED_CATEGORY_ID = "featured"

const CATEGORY_ICONS: Record<string, CategoryIcon> = {
	page: LayoutPanelTop,
	visual: Palette,
	interaction: MousePointerClick,
	data: ChartNoAxesCombined,
	persistence: Save,
	access: ShieldCheck,
	ai: Sparkles,
	reliability: Gauge,
}

function MicroAppIssuePromptLibrary({
	query,
	selectedCategory,
	language,
	onQueryChange,
	onCategoryChange,
	onSelect,
}: {
	query: string
	selectedCategory: string
	language: string
	onQueryChange: (query: string) => void
	onCategoryChange: (category: string) => void
	onSelect: (issue: MicroAppIssuePrompt) => void
}) {
	const { t } = useTranslation("super")
	const locale = resolveMicroAppIssueLocale(language)
	const issues = useMemo(() => {
		const searchedIssues = searchMicroAppIssuePrompts(
			microAppIssuePromptData.issues,
			query,
			language,
		)

		if (query.trim()) return searchedIssues
		if (selectedCategory === FEATURED_CATEGORY_ID) {
			return searchedIssues.filter((issue) => issue.featured)
		}

		return searchedIssues.filter((issue) => issue.category === selectedCategory)
	}, [language, query, selectedCategory])

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="micro-app-issue-prompts-library">
			<div className="shrink-0 border-b border-border px-3 pb-3">
				<Input
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					placeholder={t("microAppPage.issuePrompts.searchPlaceholder")}
					aria-label={t("microAppPage.issuePrompts.searchPlaceholder")}
					className="h-9 bg-muted/40"
					data-testid="micro-app-issue-prompts-search"
				/>
			</div>

			<div className="shrink-0 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<div className="flex w-max gap-1.5">
					<button
						type="button"
						onClick={() => onCategoryChange(FEATURED_CATEGORY_ID)}
						aria-pressed={selectedCategory === FEATURED_CATEGORY_ID && !query.trim()}
						className={cn(
							"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
							selectedCategory === FEATURED_CATEGORY_ID && !query.trim()
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:text-foreground",
						)}
					>
						{t("microAppPage.issuePrompts.featured")}
					</button>
					{microAppIssuePromptData.categories.map((category) => (
						<button
							key={category.id}
							type="button"
							onClick={() => onCategoryChange(category.id)}
							aria-pressed={selectedCategory === category.id && !query.trim()}
							className={cn(
								"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
								selectedCategory === category.id && !query.trim()
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground",
							)}
						>
							{category.label[locale]}
						</button>
					))}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				{issues.length ? (
					<div className="space-y-1">
						{issues.map((issue) => {
							const Icon = CATEGORY_ICONS[issue.category] ?? Database
							return (
								<button
									key={issue.id}
									type="button"
									onClick={() => onSelect(issue)}
									className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									data-testid={`micro-app-issue-prompt-${issue.id}`}
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<Icon className="size-4" aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-medium leading-5 text-foreground">
											{issue.title[locale]}
										</span>
										<span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-muted-foreground">
											{issue.description[locale]}
										</span>
									</span>
									<ChevronRight
										className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
										aria-hidden
									/>
								</button>
							)
						})}
					</div>
				) : (
					<div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
						{t("microAppPage.issuePrompts.empty")}
					</div>
				)}
			</div>
		</div>
	)
}

export default function MicroAppIssuePromptPanel({ variant }: MicroAppIssuePromptPanelProps) {
	const { t, i18n } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [selectedCategory, setSelectedCategory] = useState(FEATURED_CATEGORY_ID)
	const language = i18n?.resolvedLanguage ?? i18n?.language ?? "zh_CN"

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen)
		if (!nextOpen) setQuery("")
	}

	function handleCategoryChange(category: string) {
		setSelectedCategory(category)
		setQuery("")
	}

	function handleSelect(issue: MicroAppIssuePrompt) {
		pubsub.publish(
			PubSubEvents.Append_Suggestion_To_Editor,
			buildMicroAppIssuePrompt(issue, language),
		)
		handleOpenChange(false)
	}

	const trigger = (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				"h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground",
				variant === "mobile" && "h-8 bg-muted/60 px-2.5",
			)}
			onClick={variant === "mobile" ? () => handleOpenChange(true) : undefined}
			data-testid="micro-app-issue-prompts-trigger"
		>
			<CircleHelp className="size-3.5" aria-hidden />
			{t("microAppPage.issuePrompts.trigger")}
		</Button>
	)

	const library = (
		<MicroAppIssuePromptLibrary
			query={query}
			selectedCategory={selectedCategory}
			language={language}
			onQueryChange={setQuery}
			onCategoryChange={handleCategoryChange}
			onSelect={handleSelect}
		/>
	)

	if (variant === "mobile") {
		return (
			<>
				{trigger}
				<MagicPopup
					visible={open}
					position="bottom"
					onClose={() => handleOpenChange(false)}
					hideDefaultHandle
					title={t("microAppPage.issuePrompts.title")}
					headerVariant="actionHeader"
					headerTitle={t("microAppPage.issuePrompts.title")}
					headerSubtitle={t("microAppPage.issuePrompts.subtitle")}
					bodyClassName="h-[82dvh] max-h-[82dvh] overflow-hidden rounded-t-[20px] border-0 bg-background p-0"
				>
					<div className="flex h-full min-h-0 flex-col pt-2">{library}</div>
				</MagicPopup>
			</>
		)
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				sideOffset={8}
				className="w-[460px] max-w-[calc(100vw-24px)] overflow-hidden p-0"
			>
				<div className="border-b border-border px-4 py-3">
					<p className="text-sm font-semibold text-foreground">
						{t("microAppPage.issuePrompts.title")}
					</p>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{t("microAppPage.issuePrompts.subtitle")}
					</p>
				</div>
				<div className="flex h-[430px] min-h-0 flex-col pt-3">{library}</div>
			</PopoverContent>
		</Popover>
	)
}

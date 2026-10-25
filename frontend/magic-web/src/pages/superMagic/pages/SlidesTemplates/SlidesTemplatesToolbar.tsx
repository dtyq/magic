import { MousePointerClick, Palette, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import TemplateGroupSelector from "@/pages/superMagic/components/MainInputContainer/panels/TemplateGroupSelector"
import GroupIcon from "@/pages/superMagic/components/MainInputContainer/panels/GroupIcon"
import type { OptionGroup } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import MySlidesTemplatesTabIcon from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/MySlidesTemplatesTabIcon"
import type { MySlidesTemplateSection } from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import SlidesTemplateColorPalette from "./SlidesTemplateColorPalette"
import SlidesTemplateGlowBorder from "./SlidesTemplateGlowBorder"
import MySlidesTemplatesGroupTabs from "./MySlidesTemplatesGroupTabs"
import { MY_SLIDES_TEMPLATES_GROUP_KEY } from "./useMySlidesTemplates"

const GROUP_SCROLL_CONTROL_CLASS_NAME =
	"[&_button]:border-white/20 [&_button]:bg-zinc-800/[0.86] [&_button]:text-white [&_button]:shadow-[0_4px_14px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.12)] [&_button]:backdrop-blur-lg [&_button:hover]:bg-zinc-700/[0.92]"

const GROUP_OPTION_CLASS_NAME =
	"border-white/[0.10] bg-white/[0.10] text-white/[0.82] shadow-none hover:border-white/[0.18] hover:bg-white/[0.16] hover:text-white data-[selected=true]:border-white/[0.32] data-[selected=true]:bg-white/[0.22] data-[selected=true]:text-white data-[selected=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_22px_rgba(0,0,0,0.14)]"

export interface SlidesTemplatesToolbarProps {
	activeMyTemplatesSection: MySlidesTemplateSection
	className?: string
	groups: OptionGroup[]
	onClearSearch: () => void
	onClearSimilarColors: () => void
	onCompositionEnd: (value: string) => void
	onCompositionStart: () => void
	onFocusRandomTemplate: () => void
	onGroupChange: (groupKey: string) => void
	onMyTemplatesSectionChange: (section: MySlidesTemplateSection) => void
	onSearchChange: (value: string) => void
	randomDisabled: boolean
	searchValue: string
	selectedGroupKey: string
	similarColorAmbient?: string
	similarColorSourceColors: string[]
	similarColorSourceName: string
	showGroups: boolean
	showSimilarColors: boolean
}

export default function SlidesTemplatesToolbar({
	activeMyTemplatesSection,
	className,
	groups,
	onClearSearch,
	onClearSimilarColors,
	onCompositionEnd,
	onCompositionStart,
	onFocusRandomTemplate,
	onGroupChange,
	onMyTemplatesSectionChange,
	onSearchChange,
	randomDisabled,
	searchValue,
	selectedGroupKey,
	similarColorAmbient,
	similarColorSourceColors,
	similarColorSourceName,
	showGroups,
	showSimilarColors,
}: SlidesTemplatesToolbarProps) {
	const { t } = useTranslation("crew/create")
	const isMobile = useIsMobile()

	return (
		/*
		 * One band for the whole toolbar, so the onboarding step that points at it frames the search
		 * box, the "发现灵感" button and the category tabs together — they are one way of finding a
		 * template, and the step's wording covers all three.
		 */
		<div
			data-guide-anchor={HomeOnboardingAnchor.SlidesTemplatesToolbar}
			data-testid="slides-templates-page-toolbar"
		>
			<div className={cn("flex min-w-0 items-center gap-3", className)}>
				<div className="relative min-w-[220px] flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/[0.45]" />
					<Input
						value={searchValue}
						onChange={(event) => onSearchChange(event.target.value)}
						onCompositionStart={onCompositionStart}
						onCompositionEnd={(event) => onCompositionEnd(event.currentTarget.value)}
						placeholder={t("playbook.edit.presets.form.searchPlaceholder")}
						className="h-10 rounded-2xl border-0 bg-white/[0.09] pl-9 pr-9 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.11)] placeholder:text-white/[0.45] focus-visible:ring-white/20"
						data-testid="slides-templates-page-search-input"
					/>
					{searchValue ? (
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-full text-white/[0.65] hover:bg-white/10 hover:text-white"
							aria-label={t("playbook.edit.presets.close")}
							onClick={onClearSearch}
							data-testid="slides-templates-page-search-clear"
						>
							<X className="size-4" />
						</Button>
					) : null}
				</div>
				<Button
					type="button"
					variant="ghost"
					className="group relative isolate h-10 shrink-0 overflow-hidden rounded-2xl border-0 bg-white/[0.075] px-3 text-sm text-white/[0.88] shadow-[0_8px_22px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/[0.11] hover:text-white hover:shadow-[0_10px_28px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.16)]"
					aria-label={t("playbook.edit.presets.form.randomTemplate")}
					disabled={randomDisabled}
					onClick={onFocusRandomTemplate}
					data-testid="slides-templates-page-random-template"
				>
					<SlidesTemplateGlowBorder
						className="opacity-90 group-hover:opacity-100"
						radius={15}
					/>
					<MousePointerClick className="relative z-40 mr-1.5 size-4" />
					<span className="relative z-40">
						{t("playbook.edit.presets.form.randomTemplate")}
					</span>
				</Button>
			</div>

			{showSimilarColors ? (
				<div
					className="mt-2.5 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.07] px-2.5 py-2 text-white/[0.84] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
					style={
						similarColorAmbient
							? {
									backgroundImage: `radial-gradient(circle at 8% 50%, ${similarColorAmbient}, transparent 34%)`,
								}
							: undefined
					}
					data-testid="slides-templates-page-similar-colors-filter"
				>
					<Palette className="size-4 shrink-0 text-white/[0.72]" />
					<SlidesTemplateColorPalette colors={similarColorSourceColors} compact />
					<span className="min-w-0 flex-1 truncate text-xs font-medium">
						{t("playbook.edit.presets.form.similarColorsFor", {
							name: similarColorSourceName,
						})}
					</span>
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						className="size-7 shrink-0 rounded-full text-white/[0.58] hover:bg-white/10 hover:text-white"
						aria-label={t("playbook.edit.presets.form.clearSimilarColors")}
						onClick={onClearSimilarColors}
						data-testid="slides-templates-page-clear-similar-colors"
					>
						<X className="size-3.5" />
					</Button>
				</div>
			) : null}

			{showGroups ? (
				<TemplateGroupSelector
					groups={groups}
					selectedGroupKey={selectedGroupKey}
					onGroupChange={onGroupChange}
					renderGroupIcon={(group) => {
						if (group.group_key === MY_SLIDES_TEMPLATES_GROUP_KEY) {
							return <MySlidesTemplatesTabIcon />
						}
						return group.group_icon ? (
							<GroupIcon icon={group.group_icon} className="size-4 shrink-0" />
						) : null
					}}
					renderGroupOption={(group, optionProps) =>
						group.group_key === MY_SLIDES_TEMPLATES_GROUP_KEY ? (
							<MySlidesTemplatesGroupTabs
								activeSection={activeMyTemplatesSection}
								isSelected={selectedGroupKey === MY_SLIDES_TEMPLATES_GROUP_KEY}
								onGroupClick={() => onGroupChange(MY_SLIDES_TEMPLATES_GROUP_KEY)}
								onSectionChange={onMyTemplatesSectionChange}
								optionProps={optionProps}
								flat={isMobile}
								variant="dark"
							/>
						) : null
					}
					showEmptyGroups
					optionClassName={cn(
						GROUP_OPTION_CLASS_NAME,
						isMobile && "h-8 px-2.5 py-1.5 text-xs [&>span]:text-xs",
					)}
					className="mt-2.5"
					controlBackground="transparent"
					leftControlClassName={GROUP_SCROLL_CONTROL_CLASS_NAME}
					rightControlClassName={GROUP_SCROLL_CONTROL_CLASS_NAME}
					data-testid="slides-templates-page-group-selector"
				/>
			) : null}
		</div>
	)
}

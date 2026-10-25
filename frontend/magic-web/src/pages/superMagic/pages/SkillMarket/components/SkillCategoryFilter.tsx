import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { SkillMarketCategoryView } from "@/services/skills/SkillsService"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"

interface SkillCategoryFilterProps {
	categories: SkillMarketCategoryView[]
	selectedCategoryIds: string[]
	selectedIsFeatured?: boolean | 0 | 1 | null
	loading?: boolean
	error?: boolean
	onChange: (categoryIds: string[], isFeatured?: 0 | 1) => void
}

function SkillCategoryFilter({
	categories,
	selectedCategoryIds,
	selectedIsFeatured,
	loading = false,
	error = false,
	onChange,
}: SkillCategoryFilterProps) {
	const { t } = useTranslation("crew/market")
	const selectedCategoryId = selectedCategoryIds[0]
	const isFeaturedSelected = selectedIsFeatured === 1
	return (
		<HeadlessHorizontalScroll
			className="relative w-full"
			scrollContainerClassName="flex gap-2 overflow-x-auto py-1 pr-16 scrollbar-none"
			scrollContainerProps={{ "aria-busy": loading }}
			scrollStep={280}
			data-testid="skill-category-filter"
		>
			<div
				className="flex min-w-max gap-2"
				role="tablist"
				aria-label={t("skillsLibrary.category")}
			>
				{[
					{
						id: "all",
						label: t("skillsLibrary.allSkills"),
						active: !selectedCategoryId && !isFeaturedSelected,
						onClick: () => onChange([]),
					},
					{
						id: "featured",
						label: t("skillsLibrary.featured"),
						active: isFeaturedSelected,
						onClick: () => onChange([], 1),
					},
				].map((filter) => (
					<Button
						key={filter.id}
						variant={filter.active ? "outline" : "secondary"}
						size="sm"
						role="tab"
						aria-selected={filter.active}
						className={cn(
							"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
							filter.active
								? "border-foreground bg-background text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						data-testid={`skill-category-${filter.id}`}
						onClick={filter.onClick}
					>
						{filter.label}
					</Button>
				))}

				{categories.map((category) => {
					const isActive = selectedCategoryId === category.id && !isFeaturedSelected
					return (
						<Button
							key={category.id}
							variant={isActive ? "outline" : "secondary"}
							size="sm"
							role="tab"
							aria-selected={isActive}
							className={cn(
								"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
								isActive
									? "border-foreground bg-background text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
							data-testid={`skill-category-${category.id}`}
							onClick={() => onChange([category.id])}
						>
							{category.logo ? (
								<img
									src={category.logo}
									alt=""
									className="size-4 shrink-0 rounded-sm object-cover"
								/>
							) : null}
							{category.name}
						</Button>
					)
				})}
			</div>

			{error ? (
				<span className="shrink-0 text-xs text-destructive" role="status">
					{t("skillsLibrary.categoriesLoadFailed")}
				</span>
			) : null}
		</HeadlessHorizontalScroll>
	)
}

export default SkillCategoryFilter

import { memo } from "react"
import { UsersRound, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import type { CategoryView } from "@/services/crew/CrewService"

/** The sentinel "all" item - always rendered first */
const ALL_CATEGORY_ID = "all"

interface CategoryFilterProps {
	categories: CategoryView[]
	activeCategoryId: string
	onCategoryChange: (categoryId: string) => void
}

function CategoryFilter({ categories, activeCategoryId, onCategoryChange }: CategoryFilterProps) {
	const { t } = useTranslation("crew/market")

	return (
		<HeadlessHorizontalScroll
			className="relative w-full"
			scrollContainerClassName="flex gap-2 overflow-x-auto py-1 pr-16 scrollbar-none"
			renderRightControl={({ scroll }) => (
				<div className="absolute right-0 top-0 flex h-full items-center justify-end bg-gradient-to-r from-transparent to-background pl-8">
					<Button
						variant="outline"
						size="icon"
						className="shadow-xs size-9 shrink-0 bg-background"
						onClick={() => scroll("right")}
						data-testid="category-filter-scroll-right"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}
		>
			{/* Static "All" item */}
			<Button
				key={ALL_CATEGORY_ID}
				variant={activeCategoryId === ALL_CATEGORY_ID ? "outline" : "secondary"}
				size="sm"
				className={cn(
					"shadow-xs h-9 shrink-0 gap-2 rounded-full border-[2px] transition-colors",
					activeCategoryId === ALL_CATEGORY_ID
						? "border-foreground bg-background text-foreground"
						: "border-transparent text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onCategoryChange(ALL_CATEGORY_ID)}
				data-testid={`category-filter-${ALL_CATEGORY_ID}`}
			>
				<UsersRound className="h-4 w-4 shrink-0" />
				{t("categories.allCrew")}
			</Button>

			{/* Dynamic categories from API */}
			{categories.map((category) => {
				const isActive = activeCategoryId === category.id
				return (
					<Button
						key={category.id}
						variant={isActive ? "outline" : "secondary"}
						size="sm"
						className={cn(
							"shadow-xs h-9 shrink-0 gap-2 rounded-full border-[2px] transition-colors",
							isActive
								? "border-foreground bg-background text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						onClick={() => onCategoryChange(category.id)}
						data-testid={`category-filter-${category.id}`}
					>
						{category.logo && (
							<img
								src={category.logo}
								alt={category.name}
								className="size-4 shrink-0 rounded-sm object-cover"
							/>
						)}
						{category.name}
					</Button>
				)
			})}
		</HeadlessHorizontalScroll>
	)
}

export default memo(CategoryFilter)

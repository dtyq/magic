import { memo } from "react"
import { UsersRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import type { CategoryView } from "@/services/crew/CrewService"

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
		>
			<Button
				key={ALL_CATEGORY_ID}
				variant={activeCategoryId === ALL_CATEGORY_ID ? "outline" : "secondary"}
				size="sm"
				className={cn(
					"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
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

			{categories.map((category) => {
				const isActive = activeCategoryId === category.id
				return (
					<Button
						key={category.id}
						variant={isActive ? "outline" : "secondary"}
						size="sm"
						className={cn(
							"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
							isActive
								? "border-foreground bg-background text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						onClick={() => onCategoryChange(category.id)}
						data-testid={`category-filter-${category.id}`}
					>
						{category.logo ? (
							<img
								src={category.logo}
								alt={category.name}
								className="size-4 shrink-0 rounded-sm object-cover"
							/>
						) : null}
						{category.name}
					</Button>
				)
			})}
		</HeadlessHorizontalScroll>
	)
}

export default memo(CategoryFilter)

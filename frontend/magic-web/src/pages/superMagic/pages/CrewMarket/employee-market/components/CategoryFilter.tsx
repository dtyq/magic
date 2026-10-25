import { memo } from "react"
import { Building2, UsersRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import type { CategoryView } from "@/services/crew/CrewService"
import { ALL_MARKET_FILTER_ID, ORGANIZATION_MARKET_FILTER_ID } from "../../components/market-filter"

interface CategoryFilterProps {
	categories: CategoryView[]
	activeCategoryId: string
	onCategoryChange: (categoryId: string) => void
	showOrganizationShared?: boolean
}

function CategoryFilter({
	categories,
	activeCategoryId,
	onCategoryChange,
	showOrganizationShared = true,
}: CategoryFilterProps) {
	const { t } = useTranslation("crew/market")

	return (
		<HeadlessHorizontalScroll
			className="relative w-full"
			scrollContainerClassName="flex gap-2 overflow-x-auto py-1 pr-16 scrollbar-none"
		>
			<Button
				key={ALL_MARKET_FILTER_ID}
				variant={activeCategoryId === ALL_MARKET_FILTER_ID ? "outline" : "secondary"}
				size="sm"
				className={cn(
					"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
					activeCategoryId === ALL_MARKET_FILTER_ID
						? "border-foreground bg-background text-foreground"
						: "border-transparent text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onCategoryChange(ALL_MARKET_FILTER_ID)}
				data-testid={`category-filter-${ALL_MARKET_FILTER_ID}`}
			>
				<UsersRound className="h-4 w-4 shrink-0" />
				{t("categories.allCrew")}
			</Button>

			{showOrganizationShared ? (
				<Button
					key={ORGANIZATION_MARKET_FILTER_ID}
					variant={
						activeCategoryId === ORGANIZATION_MARKET_FILTER_ID ? "outline" : "secondary"
					}
					size="sm"
					className={cn(
						"h-9 shrink-0 gap-2 rounded-full border-[2px] shadow-xs transition-colors",
						activeCategoryId === ORGANIZATION_MARKET_FILTER_ID
							? "border-foreground bg-background text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground",
					)}
					onClick={() => onCategoryChange(ORGANIZATION_MARKET_FILTER_ID)}
					data-testid={`category-filter-${ORGANIZATION_MARKET_FILTER_ID}`}
				>
					<Building2 className="h-4 w-4 shrink-0" />
					{t("tabs.organizationShared")}
				</Button>
			) : null}

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
								data-testid="category-filter-image"
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

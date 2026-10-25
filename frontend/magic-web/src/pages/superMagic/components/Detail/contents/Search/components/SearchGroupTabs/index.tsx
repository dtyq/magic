import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import type { SearchGroup } from "../SearchBody"

interface SearchGroupTabsProps {
	groups: SearchGroup[]
	value: string
	onValueChange: (value: string) => void
	children: ReactNode
}

export default function SearchGroupTabs({
	groups,
	value,
	onValueChange,
	children,
}: SearchGroupTabsProps) {
	const { t } = useTranslation("super")
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const previousButtonRef = useRef<HTMLButtonElement>(null)
	const nextButtonRef = useRef<HTMLButtonElement>(null)
	const totalResults = groups.reduce((total, group) => total + group.results.length, 0)

	useEffect(() => {
		const container = scrollContainerRef.current
		const activeTab = container?.querySelector<HTMLElement>('[data-state="active"]')
		if (!container || !activeTab) return

		// 键盘切换也要看得见当前组；仅移动导航容器，不能把外层回放页面一起滚动。
		const containerRect = container.getBoundingClientRect()
		const tabRect = activeTab.getBoundingClientRect()
		const visibleLeft = containerRect.left + (previousButtonRef.current?.offsetWidth || 0)
		const visibleRight = containerRect.right - (nextButtonRef.current?.offsetWidth || 0)
		if (tabRect.left < visibleLeft) {
			container.scrollLeft += tabRect.left - visibleLeft
		} else if (tabRect.right > visibleRight) {
			container.scrollLeft += tabRect.right - visibleRight
		}
	}, [value])

	if (groups.length <= 1) {
		return <>{children}</>
	}

	return (
		<Tabs value={value} onValueChange={onValueChange} className="min-h-0 flex-1 gap-0">
			<div className="mx-4 flex shrink-0 items-center gap-4 border-b border-border">
				<HeadlessHorizontalScroll
					className="min-w-0 flex-1 rounded-none"
					scrollContainerRef={scrollContainerRef}
					scrollContainerClassName="pb-px"
					renderLeftControl={({ scroll }) => (
						<Button
							ref={previousButtonRef}
							variant="outline"
							size="icon"
							className="absolute left-0 top-1/2 z-10 size-8 -translate-y-1/2 bg-background [@media(pointer:coarse)]:size-11"
							aria-label={t("search.previousGroups")}
							onClick={() => scroll("left")}
						>
							<ChevronLeft size={16} aria-hidden />
						</Button>
					)}
					renderRightControl={({ scroll }) => (
						<Button
							ref={nextButtonRef}
							variant="outline"
							size="icon"
							className="absolute right-0 top-1/2 z-10 size-8 -translate-y-1/2 bg-background [@media(pointer:coarse)]:size-11"
							aria-label={t("search.nextGroups")}
							onClick={() => scroll("right")}
						>
							<ChevronRight size={16} aria-hidden />
						</Button>
					)}
				>
					<TabsList
						aria-label={t("search.batchSummary", { count: groups.length })}
						className="h-9 justify-start gap-6 rounded-none bg-transparent p-0 [@media(pointer:coarse)]:h-11"
					>
						{groups.map((group, index) => (
							<TabsTrigger
								key={group.keyword}
								value={group.keyword}
								title={group.query?.trim() || undefined}
								className="relative h-full flex-none gap-2 rounded-none border-0 px-0 py-2 font-normal text-muted-foreground shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-foreground dark:data-[state=active]:bg-transparent"
								data-testid="set-selected-keyword"
							>
								{t("search.groupLabel", { index: index + 1 })}
								<span
									className="rounded bg-muted px-1 text-[11px] font-normal tabular-nums"
									aria-label={t("search.resultCount", {
										count: group.results.length,
									})}
								>
									{group.results.length}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</HeadlessHorizontalScroll>
				<span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
					{t("search.resultCount", { count: totalResults })}
				</span>
			</div>
			<TabsContent value={value} className="flex min-h-0 flex-1 flex-col">
				{children}
			</TabsContent>
		</Tabs>
	)
}

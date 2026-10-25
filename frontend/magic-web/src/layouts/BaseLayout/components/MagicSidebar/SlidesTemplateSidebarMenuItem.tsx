import { useState, type MouseEventHandler } from "react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/shadcn-ui/sidebar"
import { useSlidesTemplateStatistics } from "@/pages/superMagic/hooks/useSlidesTemplateTotal"
import { formatNumber } from "@/utils/format"
import { cn } from "@/utils/cn"
import {
	isValidTemplateCountTodayGrowth,
	SlidesTemplateCountBadge,
} from "./SlidesTemplateCountBadge"

interface SlidesTemplateSidebarMenuItemProps {
	title: string
	testId: string
	Icon: LucideIcon
	href: string
	collapsed: boolean
	isActive?: boolean
	onClick: MouseEventHandler<HTMLAnchorElement>
}

export function SlidesTemplateSidebarMenuItem({
	title,
	testId,
	Icon,
	href,
	collapsed,
	isActive = false,
	onClick,
}: SlidesTemplateSidebarMenuItemProps) {
	const { t } = useTranslation("sidebar")
	const statistics = useSlidesTemplateStatistics()
	const [countStacked, setCountStacked] = useState(false)
	const templateTotal = statistics?.templateTotal
	const templateCountTodayGrowth = statistics?.templateCountTodayGrowth
	const hasTodayGrowth = isValidTemplateCountTodayGrowth(templateCountTodayGrowth)

	const tooltip = collapsed
		? {
				children: (
					<div
						className="flex max-w-72 flex-col gap-0.5 whitespace-normal text-sm leading-5"
						data-testid="sidebar-content-slides-templates-tooltip"
					>
						<div data-testid="sidebar-content-slides-templates-tooltip-title">
							{title}
						</div>
						{templateTotal !== undefined ? (
							<div
								className="flex flex-col items-start"
								data-testid="sidebar-content-slides-templates-tooltip-statistics"
							>
								{hasTodayGrowth ? (
									<span
										className="whitespace-nowrap"
										data-testid="sidebar-content-slides-templates-tooltip-today"
									>
										{t("slidesTemplates.todayAddedCount", {
											value: formatNumber(templateCountTodayGrowth),
										})}
									</span>
								) : null}
								<span
									className="whitespace-nowrap"
									data-testid="sidebar-content-slides-templates-tooltip-total"
								>
									{t("slidesTemplates.templateTotalCount", {
										value: formatNumber(templateTotal),
									})}
								</span>
							</div>
						) : null}
					</div>
				),
			}
		: undefined

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				tooltip={tooltip}
				data-testid={testId}
				isActive={isActive}
				className={cn(
					collapsed
						? "!text-[#ff6a1f] hover:!bg-[#fff2ec] hover:!text-[#ff6a1f]"
						: "text-sidebar-foreground",
					!collapsed && templateTotal !== undefined && "!h-8 py-0",
				)}
			>
				<a href={href} onClick={onClick} className="text-current no-underline">
					<div
						data-slides-template-row
						className="relative flex min-w-0 flex-1 items-center gap-2"
					>
						<Icon data-slides-template-icon className="h-4 w-4 shrink-0" />
						{!collapsed ? (
							<div
								data-slides-template-content
								className="relative flex h-8 min-w-0 flex-1 flex-wrap content-center items-center gap-x-2 gap-y-0"
							>
								<span
									data-slides-template-label
									className={cn(
										"whitespace-nowrap text-left",
										templateTotal !== undefined ? "shrink-0" : "min-w-0 flex-1",
										countStacked ? "text-sm leading-4" : "text-sm leading-5",
									)}
								>
									{title}
								</span>
								<span
									aria-hidden="true"
									data-slides-template-label-measure
									className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-sm leading-5"
								>
									{title}
								</span>
								{templateTotal !== undefined ? (
									<SlidesTemplateCountBadge
										count={templateTotal}
										todayAdded={templateCountTodayGrowth}
										testId="sidebar-content-slides-templates-count"
										onStackedChange={setCountStacked}
									/>
								) : null}
							</div>
						) : null}
					</div>
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}

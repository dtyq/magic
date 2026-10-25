import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconArrowsSort, IconCheck, IconChevronDown } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent } from "@/components/shadcn-ui/tooltip"
import { Trigger as TooltipTrigger } from "@radix-ui/react-tooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { type SortSelectorProps } from "../types"
import { SortType } from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"

function SortSelectorComponent({
	value,
	onChange,
	includeWorkspaceOrder,
	compact,
	responsive = false,
}: SortSelectorProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const [menuOpen, setMenuOpen] = useState(false)
	const [tooltipOpen, setTooltipOpen] = useState(false)

	const getSortLabel = (sortValue: SortType) => {
		switch (sortValue) {
			case SortType.WORKSPACE_ORDER:
				return t("projectResources.workspaceOrder")
			case SortType.PROJECT_UPDATE_TIME:
				return compact
					? t("projectResources.updateTime")
					: t("workspace.sortByProjectUpdateTime")
			case SortType.MY_LAST_ACTIVE_TIME:
				return compact
					? t("projectResources.lastActiveTime")
					: t("workspace.sortByMyLastActiveTime")
			case SortType.PROJECT_CREATE_TIME:
				return compact
					? t("projectResources.createTime")
					: t("workspace.sortByProjectCreateTime")
			default:
				return t("workspace.sortByProjectUpdateTime")
		}
	}

	return (
		<Tooltip
			open={menuOpen ? false : tooltipOpen}
			onOpenChange={(open) => setTooltipOpen(!menuOpen && open)}
		>
			<MagicDropdown
				open={menuOpen}
				onOpenChange={(open) => {
					setMenuOpen(open)
					setTooltipOpen(false)
				}}
				mobileProps={{ title: t("workspace.sort") }}
				menu={{
					items: [
						...(includeWorkspaceOrder
							? [
									{
										key: SortType.WORKSPACE_ORDER,
										label: (
											<div className="flex items-center justify-between gap-1">
												{t("projectResources.workspaceOrder")}
												{value === SortType.WORKSPACE_ORDER && (
													<MagicIcon
														component={IconCheck}
														size={16}
														className="text-primary"
													/>
												)}
											</div>
										),
									},
								]
							: []),
						{
							key: SortType.PROJECT_UPDATE_TIME,
							label: (
								<div className="flex items-center justify-between gap-1">
									{t("workspace.sortByProjectUpdateTime")}
									{value === SortType.PROJECT_UPDATE_TIME && (
										<MagicIcon
											component={IconCheck}
											size={16}
											className="text-primary"
										/>
									)}
								</div>
							),
						},
						{
							key: SortType.MY_LAST_ACTIVE_TIME,
							label: (
								<div className="flex items-center justify-between gap-1">
									{t("workspace.sortByMyLastActiveTime")}
									{value === SortType.MY_LAST_ACTIVE_TIME && (
										<MagicIcon
											component={IconCheck}
											size={16}
											className="text-primary"
										/>
									)}
								</div>
							),
						},
						{
							key: SortType.PROJECT_CREATE_TIME,
							label: (
								<div className="flex items-center justify-between gap-1">
									{t("workspace.sortByProjectCreateTime")}
									{value === SortType.PROJECT_CREATE_TIME && (
										<MagicIcon
											component={IconCheck}
											size={16}
											className="text-primary"
										/>
									)}
								</div>
							),
						},
					],
					onClick: ({ key }) => onChange(key as SortType),
				}}
			>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label={`${t("workspace.sort")}：${getSortLabel(value)}`}
						className={cn(
							"h-8 px-2.5",
							responsive &&
								"[@container_(max-width:760px)]:size-10 [@container_(max-width:760px)]:px-0",
						)}
					>
						<div className="flex items-center gap-1">
							<MagicIcon component={IconArrowsSort} size={16} />
							<div
								className={cn(
									"flex items-center gap-1",
									responsive && "[@container_(max-width:760px)]:hidden",
								)}
							>
								{!compact && (
									<span className="text-xs font-normal leading-4 text-muted-foreground">
										{t("workspace.sort")}
									</span>
								)}
								<span className="text-xs font-normal leading-4 text-foreground">
									{getSortLabel(value)}
								</span>
								<MagicIcon component={IconChevronDown} size={14} />
							</div>
						</div>
					</Button>
				</TooltipTrigger>
			</MagicDropdown>
			{!isMobile && responsive && (
				<TooltipContent>
					{t("workspace.sort")}：{getSortLabel(value)}
				</TooltipContent>
			)}
		</Tooltip>
	)
}

export default memo(SortSelectorComponent)

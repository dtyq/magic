import { useTranslation } from "react-i18next"
import { Check, ChevronDown, Filter } from "lucide-react"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Button } from "@/components/shadcn-ui/button"
import type { SuperMagicApi } from "@/apis"
import { useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Tooltip, TooltipContent } from "@/components/shadcn-ui/tooltip"
import { Trigger as TooltipTrigger } from "@radix-ui/react-tooltip"
import { cn } from "@/utils/cn"

export type RecentProjectType = NonNullable<
	Parameters<typeof SuperMagicApi.getProjectsWithCollaboration>[0]["project_type"]
>

export function ProjectTypeFilter({
	value,
	onChange,
	responsive = false,
}: {
	value: RecentProjectType
	onChange: (value: RecentProjectType) => void
	responsive?: boolean
}) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const [menuOpen, setMenuOpen] = useState(false)
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const options: { key: RecentProjectType; label: string }[] = [
		{ key: "all", label: t("projectResources.allTypes") },
		{ key: "general", label: t("projectResources.generalType") },
		{ key: "claw", label: t("projectTypeTag.magicClaw") },
		{ key: "micro-app", label: t("projectTypeTag.microApp") },
		{ key: "agent", label: t("projectTypeTag.agent") },
		{ key: "skill", label: t("projectTypeTag.skill") },
	]
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
				mobileProps={{ title: t("projectResources.filterType") }}
				menu={{
					items: options.map(({ key, label }) => ({
						key,
						label: (
							<div className="flex items-center justify-between gap-2">
								{label}
								{value === key && <Check size={16} />}
							</div>
						),
					})),
					onClick: ({ key }) => {
						const option = options.find((item) => item.key === key)
						if (option) onChange(option.key)
					},
				}}
			>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						aria-label={t("projectResources.filterType")}
						className={cn(
							"relative h-8 gap-1 text-xs",
							value !== "all" && "bg-primary/5 text-primary",
							responsive &&
								"[@container_(max-width:760px)]:size-10 [@container_(max-width:760px)]:px-0",
						)}
					>
						<Filter size={16} />
						<span
							className={cn(
								"flex items-center gap-1",
								responsive && "[@container_(max-width:760px)]:hidden",
							)}
						>
							{options.find((item) => item.key === value)?.label}
							<ChevronDown size={16} />
						</span>
						{value !== "all" && responsive && (
							<span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
						)}
					</Button>
				</TooltipTrigger>
			</MagicDropdown>
			{!isMobile && responsive && (
				<TooltipContent>
					{t("projectResources.filterType")}：
					{options.find((item) => item.key === value)?.label}
				</TooltipContent>
			)}
		</Tooltip>
	)
}

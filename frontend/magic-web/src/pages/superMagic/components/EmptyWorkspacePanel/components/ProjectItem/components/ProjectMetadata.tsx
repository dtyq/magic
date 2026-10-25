import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicDropdown from "@/components/base/MagicDropdown"
import SmartTooltip from "@/components/other/SmartTooltip"
import dayjs from "@/infrastructure/vendors/dayjs"
import { cn } from "@/utils/cn"

interface ActivityTimeLabelProps {
	relative: boolean
	onChange: (relative: boolean) => void
}

export function ActivityTimeLabel({ relative, onChange }: ActivityTimeLabelProps) {
	const { t } = useTranslation("super")
	return (
		<span
			className="inline-flex shrink-0"
			onClick={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onContextMenu={(event) => event.stopPropagation()}
		>
			<MagicDropdown
				placement="bottomLeft"
				menu={{
					items: [
						{
							key: "relative",
							label: (
								<span className="flex items-center justify-between gap-3">
									{t("sidebarPanels.relativeTime")}
									{relative && <Check size={16} />}
								</span>
							),
						},
						{
							key: "absolute",
							label: (
								<span className="flex items-center justify-between gap-3">
									{t("sidebarPanels.absoluteTime")}
									{!relative && <Check size={16} />}
								</span>
							),
						},
					],
					onClick: ({ key, domEvent }) => {
						domEvent.stopPropagation()
						onChange(key === "relative")
					},
				}}
			>
				<button
					type="button"
					className="-ml-1 inline-flex items-center gap-1 rounded px-1 text-xs font-normal outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={t("sidebarPanels.activityTimeFormat", {
						format: relative
							? t("sidebarPanels.relativeTime")
							: t("sidebarPanels.absoluteTime"),
					})}
				>
					{t("sidebarPanels.lastActiveTime")}
					<ChevronDown size={16} aria-hidden="true" />
				</button>
			</MagicDropdown>
		</span>
	)
}

interface ProjectMetadataProps {
	mobile?: boolean
	list: boolean
	recent: boolean
	locationName?: string
	time: { value: string; label: string }
	timeLabel: string
	createdAt?: string
	relativeActiveTime: boolean
	onRelativeActiveTimeChange?: (relative: boolean) => void
}

export default function ProjectMetadata({
	mobile = false,
	list,
	recent,
	locationName,
	time,
	timeLabel,
	createdAt,
	relativeActiveTime,
	onRelativeActiveTimeChange,
}: ProjectMetadataProps) {
	const { t } = useTranslation("super")
	const createdTime = createdAt ? dayjs(createdAt) : null
	const createdValue = createdTime?.isValid() ? createdTime.format("YYYY/MM/DD") : "—"
	// 卡片和手机已用主时间显示创建时间时，省去重复日期；宽列表保留表头对应的创建列。
	const showCreatedTime = timeLabel !== t("sidebarPanels.createdTime") || (list && !mobile)
	const labelClassName = cn("shrink-0", list && "[@container_(min-width:800px)]:hidden")
	if (mobile) {
		return (
			<div className="col-start-2 row-start-2 flex min-w-0 flex-col gap-1 text-xs leading-4 text-muted-foreground">
				{recent && locationName && (
					<SmartTooltip
						className="text-xs leading-4"
						disabled
						data-testid="project-item-location"
					>
						{locationName}
					</SmartTooltip>
				)}
				{/* 手机将活动与创建信息放在同一区域，保留已有格式选择和创建日期。 */}
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					{time.value && (
						<div className="flex min-w-0 flex-wrap items-center gap-x-1">
							{recent && onRelativeActiveTimeChange ? (
								<ActivityTimeLabel
									relative={relativeActiveTime}
									onChange={onRelativeActiveTimeChange}
								/>
							) : (
								<span>{timeLabel}</span>
							)}
							<span data-testid="project-item-time">{time.value}</span>
						</div>
					)}
					{showCreatedTime && createdTime?.isValid() && (
						<span>
							{t("sidebarPanels.createdTime")} {createdValue}
						</span>
					)}
				</div>
			</div>
		)
	}
	return (
		<div
			className={cn(
				"flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground",
				list && "col-start-2 row-start-2 [@container_(min-width:800px)]:contents",
			)}
		>
			{/* 宽列表把同一份元信息放到命名列；窄行与卡片按位置、活动、创建顺序带标签展示。 */}
			{recent && (
				<div
					className={cn(
						"flex w-full min-w-0 items-center gap-1",
						list &&
							"[@container_(min-width:800px)]:col-start-[location] [@container_(min-width:800px)]:row-start-1",
					)}
				>
					<span className={labelClassName}>{t("sidebarPanels.projectLocation")}</span>
					<SmartTooltip className="min-w-0 text-xs" data-testid="project-item-location">
						{locationName || "—"}
					</SmartTooltip>
				</div>
			)}
			<div
				className={cn(
					"flex min-w-0 flex-wrap items-center gap-x-1",
					list &&
						"[@container_(min-width:800px)]:col-start-[time] [@container_(min-width:800px)]:row-start-1",
				)}
			>
				<span className={labelClassName}>
					{recent && onRelativeActiveTimeChange ? (
						<ActivityTimeLabel
							relative={relativeActiveTime}
							onChange={onRelativeActiveTimeChange}
						/>
					) : (
						timeLabel
					)}
				</span>
				<SmartTooltip
					className="min-w-0 text-xs"
					maxLines={0}
					data-testid="project-item-time"
				>
					{time.value}
				</SmartTooltip>
			</div>
			{showCreatedTime && (
				<div
					className={cn(
						"flex min-w-0 items-center gap-1",
						list &&
							"[@container_(min-width:800px)]:col-start-[created] [@container_(min-width:800px)]:row-start-1",
					)}
				>
					<span className={labelClassName}>{t("sidebarPanels.createdTime")}</span>
					<span className="whitespace-nowrap">{createdValue}</span>
				</div>
			)}
		</div>
	)
}

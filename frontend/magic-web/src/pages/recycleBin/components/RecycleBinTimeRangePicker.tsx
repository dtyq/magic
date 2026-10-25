import { useId, useState } from "react"
import { DatePicker } from "antd"
import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import {
	parseRecycleBinTime,
	type RecycleBinSearchPeriod,
	type RecycleBinTimeRange,
} from "./recycle-bin-file-view"

interface Props {
	period: RecycleBinSearchPeriod
	range: RecycleBinTimeRange
	maxHours: number
	disabled: boolean
	invalid: boolean
	onPeriodChange: (period: RecycleBinSearchPeriod) => void
	onRangeChange: (range: RecycleBinTimeRange) => void
}

const PRESET_HOURS = [1, 7, 24, 72, 120, 168, 360]

/** 快捷范围与完整日期范围共用查询草稿；弹层只管理打开状态，不持有第二份已提交范围。 */
export function RecycleBinTimeRangePicker({
	period,
	range,
	maxHours,
	disabled,
	invalid,
	onPeriodChange,
	onRangeChange,
}: Props) {
	const { t } = useTranslation("super")
	const id = useId()
	const [presetsOpen, setPresetsOpen] = useState(false)
	const [rangeOpen, setRangeOpen] = useState(false)
	const [showRelative, setShowRelative] = useState(false)
	const [amount, setAmount] = useState("1")
	const [unit, setUnit] = useState("hour")
	const selectedHours =
		period === "recent" ? maxHours : typeof period === "number" ? period : null
	const relativeHours = Number(amount) * (unit === "day" ? 24 : 1)
	const relativeValid =
		Number.isFinite(relativeHours) && relativeHours > 0 && relativeHours <= maxHours
	const presets = [
		...new Set([...PRESET_HOURS.filter((hours) => hours <= maxHours), maxHours]),
	].sort((a, b) => a - b)
	const label = (hours: number) =>
		hours % 24 === 0
			? t("recycleBin.project.recentDays", { days: hours / 24 })
			: t("recycleBin.project.recentHours", { hours })
	const selectPeriod = (next: RecycleBinSearchPeriod) => {
		onPeriodChange(next)
		setPresetsOpen(false)
	}

	return (
		<>
			<div className="flex flex-col gap-1">
				<span id={`${id}-period`} className="text-xs text-muted-foreground">
					{t("recycleBin.project.deletionPeriod")}
				</span>
				<Popover
					open={presetsOpen && !disabled}
					onOpenChange={(open) => {
						setPresetsOpen(open)
						if (open) setRangeOpen(false)
					}}
				>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							className="h-9 min-w-36 justify-between"
							disabled={disabled}
							aria-labelledby={`${id}-period ${id}-value`}
						>
							<span id={`${id}-value`}>
								{selectedHours === null
									? t("recycleBin.project.customPeriod")
									: label(selectedHours)}
							</span>
							<ChevronDown size={16} />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-72 p-2">
						<div className="flex flex-col gap-1">
							{presets.map((hours) => (
								<Button
									key={hours}
									type="button"
									variant="ghost"
									className="h-8 justify-between"
									aria-pressed={selectedHours === hours}
									onClick={() => selectPeriod(hours)}
								>
									{label(hours)}
									{selectedHours === hours && <Check size={16} />}
								</Button>
							))}
							<Button
								type="button"
								variant="ghost"
								className="h-8 justify-between"
								onClick={() => {
									selectPeriod("custom")
									setRangeOpen(true)
								}}
							>
								{t("recycleBin.project.customPeriod")}
								{selectedHours === null && <Check size={16} />}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="h-8 justify-start"
								aria-expanded={showRelative}
								onClick={() => setShowRelative(!showRelative)}
							>
								{t("recycleBin.project.otherRecentPeriod")}
							</Button>
						</div>
						{showRelative && (
							<div className="mt-2 space-y-2 border-t border-border pt-2">
								<label
									htmlFor={`${id}-amount`}
									className="text-xs text-muted-foreground"
								>
									{t("recycleBin.project.relativeAmount")}
								</label>
								<div className="flex items-center gap-2">
									<Input
										id={`${id}-amount`}
										type="number"
										min={0}
										max={unit === "day" ? maxHours / 24 : maxHours}
										step="any"
										value={amount}
										onChange={(event) => setAmount(event.target.value)}
										className="h-8 min-w-0 flex-1"
									/>
									<Select value={unit} onValueChange={setUnit}>
										<SelectTrigger
											size="sm"
											aria-label={t("recycleBin.project.timeUnit")}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="hour">
												{t("recycleBin.project.hours")}
											</SelectItem>
											<SelectItem value="day">
												{t("recycleBin.project.days")}
											</SelectItem>
										</SelectContent>
									</Select>
									<Button
										type="button"
										size="sm"
										disabled={!relativeValid}
										onClick={() => selectPeriod(relativeHours)}
									>
										{t("recycleBin.project.applyRange")}
									</Button>
								</div>
								{!relativeValid && (
									<p className="text-xs text-destructive">
										{t("recycleBin.project.invalidRange", {
											days: maxHours / 24,
										})}
									</p>
								)}
							</div>
						)}
					</PopoverContent>
				</Popover>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-80">
				<span id={`${id}-range`} className="text-xs text-muted-foreground">
					{t("recycleBin.project.dateTimeRange")}
				</span>
				<DatePicker.RangePicker
					id={{ start: `${id}-start`, end: `${id}-end` }}
					aria-labelledby={`${id}-range`}
					className="h-9 w-full"
					value={[parseRecycleBinTime(range.start), parseRecycleBinTime(range.end)]}
					format="YYYY-MM-DD HH:mm"
					showTime={{ format: "HH:mm" }}
					allowClear={false}
					disabled={disabled}
					status={invalid ? "error" : undefined}
					open={rangeOpen && !disabled}
					onOpenChange={(open) => {
						setRangeOpen(open)
						if (open) setPresetsOpen(false)
					}}
					placeholder={[
						t("recycleBin.project.startTime"),
						t("recycleBin.project.endTime"),
					]}
					onChange={(dates) => {
						if (!dates?.[0] || !dates[1]) return
						// 日期面板返回用户选择的钟面时间；由查询 hook 按 UTC+08:00 解释，避免设备时区改变查询。
						onRangeChange({
							start: dates[0].format("YYYY-MM-DDTHH:mm:ss"),
							end: dates[1].format("YYYY-MM-DDTHH:mm:ss"),
						})
					}}
				/>
			</div>
		</>
	)
}

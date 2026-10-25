import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { getSelfMediaPostActionClassName } from "./SelfMediaPostActionButton"
import { ScheduledTask } from "@/types/scheduledTask"
import type { SelfMediaPostOpsSourcePayload } from "../services/SelfMediaFileStorageService"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"

const DATA_POPOVER_CLOSE_DELAY = 120
const DEFAULT_AUTO_SYNC_ENABLED = false

interface SelfMediaPostDataPopoverProps {
	item: SelfMediaPlatformPostItem
	postId: string
	label: string
	showLabel: boolean
	publishedUrl?: string
	onPostPublishRefresh?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl?: string,
	) => Promise<void> | void
	onConfigureAutoSync?: (
		target: SelfMediaPlatformPostItem,
		config: { enabled: boolean; timeConfig: ScheduledTask.TimeConfig },
	) => Promise<boolean | void> | boolean | void
	onLoadOpsSource?: (
		target: SelfMediaPlatformPostItem,
	) => Promise<SelfMediaPostOpsSourcePayload | null> | SelfMediaPostOpsSourcePayload | null
}

function SelfMediaPostDataPopover({
	item,
	postId,
	label,
	showLabel,
	publishedUrl,
	onPostPublishRefresh,
	onConfigureAutoSync,
	onLoadOpsSource,
}: SelfMediaPostDataPopoverProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const [syncing, setSyncing] = useState(false)
	const [savingAutoSync, setSavingAutoSync] = useState(false)
	const [loadingAutoSync, setLoadingAutoSync] = useState(false)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [frequency, setFrequency] = useState<ScheduledTask.ScheduleType>(
		ScheduledTask.ScheduleType.Daily,
	)
	const [time, setTime] = useState("09:00")
	const [day, setDay] = useState("1")
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(DEFAULT_AUTO_SYNC_ENABLED)
	const triggerLabel = onPostPublishRefresh ? label : t("detail.selfMedia.home.autoSync")
	const timeConfig: ScheduledTask.TimeConfig = useMemo(
		() => ({
			type: frequency,
			time,
			...(frequency === ScheduledTask.ScheduleType.Weekly ||
			frequency === ScheduledTask.ScheduleType.Monthly
				? { day }
				: {}),
		}),
		[day, frequency, time],
	)
	const applyAutoSyncConfig = useCallback(
		(autoSync?: SelfMediaPostOpsSourcePayload["autoSync"]) => {
			const savedTimeConfig = autoSync?.timeConfig
			setAutoSyncEnabled(Boolean(autoSync?.enabled && autoSync.taskId))
			setFrequency(savedTimeConfig?.type ?? ScheduledTask.ScheduleType.Daily)
			setTime(savedTimeConfig?.time || "09:00")
			setDay(savedTimeConfig?.day || "1")
		},
		[],
	)

	const clearCloseTimer = useCallback(() => {
		if (!closeTimerRef.current) return
		clearTimeout(closeTimerRef.current)
		closeTimerRef.current = null
	}, [])

	const openAutoSyncPopover = useCallback(() => {
		clearCloseTimer()
		if (!open && onLoadOpsSource) setLoadingAutoSync(true)
		setOpen(true)
	}, [clearCloseTimer, onLoadOpsSource, open])

	const scheduleCloseAutoSyncPopover = useCallback(() => {
		clearCloseTimer()
		closeTimerRef.current = setTimeout(() => {
			setOpen(false)
			closeTimerRef.current = null
		}, DATA_POPOVER_CLOSE_DELAY)
	}, [clearCloseTimer])

	useEffect(() => clearCloseTimer, [clearCloseTimer])

	useEffect(() => {
		if (!open) return
		applyAutoSyncConfig()
		if (!onLoadOpsSource) {
			setLoadingAutoSync(false)
			return
		}

		let cancelled = false
		setLoadingAutoSync(true)
		void Promise.resolve(onLoadOpsSource(item))
			.then((source) => {
				if (cancelled) return
				applyAutoSyncConfig(source?.autoSync)
			})
			.catch(() => undefined)
			.finally(() => {
				if (!cancelled) setLoadingAutoSync(false)
			})
		return () => {
			cancelled = true
		}
	}, [applyAutoSyncConfig, item, onLoadOpsSource, open])

	const handleSyncNow = useCallback(async () => {
		if (!onPostPublishRefresh) return
		setSyncing(true)
		try {
			await onPostPublishRefresh(item, publishedUrl?.trim() || undefined)
			setOpen(false)
		} finally {
			setSyncing(false)
		}
	}, [item, onPostPublishRefresh, publishedUrl])

	const handleTriggerClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			if (onPostPublishRefresh) {
				void handleSyncNow()
				return
			}
			openAutoSyncPopover()
		},
		[handleSyncNow, onPostPublishRefresh, openAutoSyncPopover],
	)

	const handleConfigureAutoSync = useCallback(async () => {
		if (!onConfigureAutoSync) return
		setSavingAutoSync(true)
		try {
			const configured = await onConfigureAutoSync(item, {
				enabled: autoSyncEnabled,
				timeConfig,
			})
			if (configured !== false) setOpen(false)
		} finally {
			setSavingAutoSync(false)
		}
	}, [autoSyncEnabled, item, onConfigureAutoSync, timeConfig])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen)
			if (nextOpen) setLoadingAutoSync(Boolean(onLoadOpsSource))
		},
		[onLoadOpsSource],
	)

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={getSelfMediaPostActionClassName(showLabel)}
					aria-label={triggerLabel}
					title={showLabel ? undefined : triggerLabel}
					onMouseEnter={openAutoSyncPopover}
					onMouseLeave={scheduleCloseAutoSyncPopover}
					onClick={handleTriggerClick}
					data-testid={`self-media-home-post-ops-data-${postId}`}
				>
					{syncing ? (
						<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
					) : onPostPublishRefresh ? (
						<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					) : (
						<CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					)}
					{showLabel ? <span className="whitespace-nowrap">{triggerLabel}</span> : null}
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				className={`w-[min(20rem,calc(100vw-2rem))] space-y-3 p-3 ${selfMediaOverlayStyles.floatingPanel}`}
				onMouseEnter={openAutoSyncPopover}
				onMouseLeave={scheduleCloseAutoSyncPopover}
				data-testid={`self-media-home-post-data-popover-${postId}`}
			>
				<div className="flex items-center gap-2 text-xs font-medium text-foreground">
					<CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
					{t("detail.selfMedia.home.autoSync")}
				</div>
				<p className="text-xs text-muted-foreground">
					{t("detail.selfMedia.home.autoSyncDescription")}
				</p>
				{loadingAutoSync ? (
					<div
						className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background/70 px-4 py-5 text-xs text-muted-foreground"
						data-testid={`self-media-home-post-auto-sync-loading-${postId}`}
					>
						<Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
						<span>{t("detail.selfMedia.home.loadingAutoSync")}</span>
					</div>
				) : (
					<>
						<div className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs">
							<span className="text-muted-foreground">
								{t("detail.selfMedia.home.autoSyncStatus")}
							</span>
							<select
								value={autoSyncEnabled ? "1" : "0"}
								onChange={(event) => setAutoSyncEnabled(event.target.value === "1")}
								className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
								data-testid={`self-media-home-post-auto-sync-enabled-${postId}`}
							>
								<option value="1" data-testid="self-media-post-data-popover-option">
									{t("detail.selfMedia.home.autoSyncEnabled")}
								</option>
								<option
									value="0"
									data-testid="self-media-post-data-popover-option-2"
								>
									{t("detail.selfMedia.home.autoSyncDisabled")}
								</option>
							</select>
						</div>
						<div className="grid grid-cols-[1fr_auto] gap-2">
							<select
								value={frequency}
								disabled={!autoSyncEnabled}
								onChange={(event) =>
									setFrequency(event.target.value as ScheduledTask.ScheduleType)
								}
								className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
								data-testid={`self-media-home-post-auto-sync-frequency-${postId}`}
							>
								<option
									value={ScheduledTask.ScheduleType.Daily}
									data-testid="self-media-post-data-popover-option-3"
								>
									{t("detail.selfMedia.home.autoSyncDaily")}
								</option>
								<option
									value={ScheduledTask.ScheduleType.Weekly}
									data-testid="self-media-post-data-popover-option-4"
								>
									{t("detail.selfMedia.home.autoSyncWeekly")}
								</option>
								<option
									value={ScheduledTask.ScheduleType.Monthly}
									data-testid="self-media-post-data-popover-option-5"
								>
									{t("detail.selfMedia.home.autoSyncMonthly")}
								</option>
							</select>
							<Input
								type="time"
								value={time}
								disabled={!autoSyncEnabled}
								onChange={(event) => setTime(event.target.value)}
								className="h-8 w-24 text-xs"
								data-testid={`self-media-home-post-auto-sync-time-${postId}`}
							/>
						</div>
						{frequency !== ScheduledTask.ScheduleType.Daily ? (
							<Input
								value={day}
								disabled={!autoSyncEnabled}
								onChange={(event) => setDay(event.target.value)}
								className="h-8 text-xs"
								placeholder={
									frequency === ScheduledTask.ScheduleType.Weekly
										? t("detail.selfMedia.home.autoSyncWeekdayPlaceholder")
										: t("detail.selfMedia.home.autoSyncMonthDayPlaceholder")
								}
								data-testid={`self-media-home-post-auto-sync-day-${postId}`}
							/>
						) : null}
						<Button
							type="button"
							size="sm"
							className={`w-full ${selfMediaOverlayStyles.primaryButtonCompact}`}
							disabled={!onConfigureAutoSync || savingAutoSync}
							onClick={() => void handleConfigureAutoSync()}
							data-testid={`self-media-home-post-auto-sync-save-${postId}`}
						>
							{savingAutoSync ? (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							) : null}
							{autoSyncEnabled
								? t("detail.selfMedia.home.autoSyncSave")
								: t("detail.selfMedia.home.autoSyncTurnOff")}
						</Button>
					</>
				)}
			</PopoverContent>
		</Popover>
	)
}

export default SelfMediaPostDataPopover

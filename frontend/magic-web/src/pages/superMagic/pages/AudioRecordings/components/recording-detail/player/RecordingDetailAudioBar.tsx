import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { ChevronDown, Ellipsis, Maximize2, Minimize2, Pause, Play } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MagicTooltip } from "@/components/base"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import { useRecordingPlayerCurrentSec } from "../../../hooks/useRecordingPlayerCurrentSec"
import { formatRecordingTime } from "../../../utils/time"
import type { FlatColorSegment } from "../../../utils/chapter-color-segments"
import { buildSimulatedWaveformBars } from "../../../utils/simulated-waveform-bars"
import { LiveAudioWaveformSeek } from "./LiveAudioWaveformSeek"
import { SkipBack15Icon, SkipForward15Icon, ExpandPlayerIcon } from "./player-icons"

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const
export const PLAYBACK_SKIP_SEC = 15

const GHOST_CONTROL_BTN =
	"flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/70 active:bg-muted/90"

/** Compact ghost hit target used by the collapsed transport row so skip stays visible without crowding time/waveform. */
const COLLAPSED_GHOST_CONTROL_BTN =
	"flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/70 active:bg-muted/90"

export type RecordingDetailAudioBarChrome = "shadow" | "outlined"
export type RecordingDetailRateMenuPlacement = "up" | "down"

interface RecordingDetailAudioBarProps {
	audioRef: RefObject<HTMLAudioElement>
	audioUrl: string
	durationSec: number
	currentSec: number
	playing: boolean
	expanded: boolean
	rate: number
	peakNorms?: number[]
	colorSegments?: FlatColorSegment[]
	chrome?: RecordingDetailAudioBarChrome
	scrollSignal?: number
	/**
	 * PC collapsed row keeps rate and ±15s in a more menu so the waveform can use the row.
	 * Mobile keeps the compact play/time/waveform/expand row when this is omitted.
	 */
	collapsedTransportControls?: boolean
	/**
	 * PC workbench clips upward menus, so the desktop shell always passes "down".
	 * Mobile expanded stays "up" (default) because the bar is fixed to the bottom edge.
	 */
	rateMenuPlacement?: RecordingDetailRateMenuPlacement
	onExpandedChange: (expanded: boolean) => void
	onTogglePlay: () => void
	onSeek: (sec: number) => void
	onPlaybackRateChange: (rate: number) => void
	onSkipBack?: () => void
	onSkipForward?: () => void
}

interface PlaybackRateMenuProps {
	rate: number
	open: boolean
	openDownward: boolean
	wrapRef: RefObject<HTMLDivElement>
	onToggleOpen: () => void
	onSelectRate: (rate: number) => void
}

interface CollapsedTransportMoreMenuProps {
	rate: number
	scrollSignal: number
	onSelectRate: (rate: number) => void
	onSkipBack: () => void
	onSkipForward: () => void
}

/** Formats seconds as HH:MM:SS for the expanded player time row. */
function formatHMS(sec: number): string {
	const t = Math.max(0, sec)
	const h = Math.floor(t / 3600)
	const m = Math.floor((t % 3600) / 60)
	const s = Math.floor(t % 60)
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** Formats playback rate labels consistently across the rate menu. */
function formatPlaybackRateLabel(rate: number): string {
	if (rate === 1 || rate === 2) return rate.toFixed(1)
	return String(rate)
}

/**
 * Playback-rate trigger + listbox for the expanded player.
 * Placement is injected by the shell: PC opens downward to escape workbench overflow clipping.
 */
function PlaybackRateMenu({
	rate,
	open,
	openDownward,
	wrapRef,
	onToggleOpen,
	onSelectRate,
}: PlaybackRateMenuProps) {
	const { t } = useTranslation("audioRecordings")
	const rateLabel = t("detail.player.playbackSpeed", {
		rate: formatPlaybackRateLabel(rate),
	})

	return (
		<div className="relative flex justify-center" ref={wrapRef}>
			<button
				type="button"
				onClick={onToggleOpen}
				className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-[14px] font-medium tabular-nums text-foreground transition-colors hover:bg-muted/70 active:bg-muted/90"
				aria-label={t("detail.player.playbackRateMenuAria")}
				aria-expanded={open}
				aria-haspopup="listbox"
				data-testid="recording-detail-player-rate-trigger"
			>
				{rateLabel}
				<ChevronDown
					className={cn(
						"size-4 shrink-0 opacity-70 transition-transform",
						open && "rotate-180",
					)}
					strokeWidth={2}
				/>
			</button>
			{open ? (
				<div
					role="listbox"
					aria-label={t("detail.player.playbackRateMenuAria")}
					className={cn(
						"absolute left-0 z-50 min-w-[9.5rem] rounded-xl border border-border bg-card py-1 shadow-md",
						openDownward ? "top-full mt-1" : "bottom-full mb-1",
					)}
					data-testid="recording-detail-player-rate-content"
				>
					{PLAYBACK_RATES.map((playbackRate) => (
						<button
							key={playbackRate}
							type="button"
							role="option"
							aria-selected={playbackRate === rate}
							onClick={() => onSelectRate(playbackRate)}
							className={cn(
								"flex w-full cursor-pointer items-center px-3 py-2 text-left text-[14px] tabular-nums transition-colors hover:bg-muted/80",
								playbackRate === rate
									? "bg-muted/70 font-medium text-foreground"
									: "text-foreground",
							)}
						>
							{t("detail.player.playbackSpeed", {
								rate: formatPlaybackRateLabel(playbackRate),
							})}
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}

/**
 * Collapsed PC transport menu. Rate and ±15s stay available without sitting on the waveform row.
 * The menu opens downward because the player sits under the workbench header.
 */
function CollapsedTransportMoreMenu({
	rate,
	scrollSignal,
	onSelectRate,
	onSkipBack,
	onSkipForward,
}: CollapsedTransportMoreMenuProps) {
	const { t } = useTranslation("audioRecordings")
	const [open, setOpen] = useState(false)

	useEffect(() => {
		if (scrollSignal > 0) setOpen(false)
	}, [scrollSignal])

	/** Applies a radio value from the menu. Invalid values are ignored so the player rate stays unchanged. */
	function handleRateValueChange(value: string) {
		const playbackRate = Number(value)
		if (!Number.isFinite(playbackRate)) return
		onSelectRate(playbackRate)
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<MagicTooltip title={t("detail.player.moreActions")} placement="bottom" disabled={open}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={COLLAPSED_GHOST_CONTROL_BTN}
						aria-label={t("detail.player.moreActions")}
						data-testid="recording-detail-player-more-trigger"
					>
						<Ellipsis className="size-4" />
					</button>
				</DropdownMenuTrigger>
			</MagicTooltip>
			<DropdownMenuContent
				align="end"
				side="bottom"
				className="min-w-[11rem] rounded-xl border border-border bg-card py-1 text-[13px] shadow-md"
				data-testid="recording-detail-player-more-content"
			>
				<DropdownMenuLabel className="px-3 text-[12px] font-medium text-muted-foreground">
					{t("detail.player.playbackRateMenuAria")}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={String(rate)}
					onValueChange={handleRateValueChange}
					aria-label={t("detail.player.playbackRateMenuAria")}
					data-testid="recording-detail-player-rate-content"
				>
					{PLAYBACK_RATES.map((playbackRate) => (
						<DropdownMenuRadioItem
							key={playbackRate}
							value={String(playbackRate)}
							className="cursor-pointer text-[13px] tabular-nums"
						>
							{t("detail.player.playbackSpeed", {
								rate: formatPlaybackRateLabel(playbackRate),
							})}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={onSkipBack}
					className="cursor-pointer gap-2 px-3 text-[13px]"
					data-testid="recording-detail-player-skip-back-button"
				>
					<SkipBack15Icon className="size-4" />
					{t("detail.player.skipBackAria")}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={onSkipForward}
					className="cursor-pointer gap-2 px-3 text-[13px]"
					data-testid="recording-detail-player-skip-forward-button"
				>
					<SkipForward15Icon className="size-4" />
					{t("detail.player.skipForwardAria")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Decides whether the expanded rate listbox opens below the trigger. Unset placement stays upward for the mobile bottom bar. */
function resolveOpenRateMenuDownward(
	placement: RecordingDetailRateMenuPlacement | undefined,
): boolean {
	return placement === "down"
}

/**
 * Shared recording detail audio bar used by PC and mobile shells.
 * Visual and interaction behavior align with the product prototype.
 */
export function RecordingDetailAudioBar({
	audioRef,
	audioUrl,
	durationSec,
	currentSec,
	playing,
	expanded,
	rate,
	peakNorms: peakNormsOverride,
	colorSegments,
	chrome = "shadow",
	scrollSignal = 0,
	collapsedTransportControls = false,
	rateMenuPlacement,
	onExpandedChange,
	onTogglePlay,
	onSeek,
	onPlaybackRateChange,
	onSkipBack,
	onSkipForward,
}: RecordingDetailAudioBarProps) {
	const { t } = useTranslation("audioRecordings")
	const [rateMenuOpen, setRateMenuOpen] = useState(false)
	const rateMenuWrapRef = useRef<HTMLDivElement>(null)
	const peakNorms = useMemo(
		() => peakNormsOverride ?? buildSimulatedWaveformBars(),
		[peakNormsOverride],
	)

	const duration = Math.max(0, durationSec)
	// Track playback currentTime with requestAnimationFrame locally inside the audio bar
	// to isolate high-frequency re-renders from the entire detail page tree.
	const liveCurrentSec = useRecordingPlayerCurrentSec(audioRef, playing, currentSec)
	const waveformMaxPx = expanded ? 52 : 15
	const seekKeyboardStep = expanded ? PLAYBACK_SKIP_SEC : 5
	const showCollapsedTransport = collapsedTransportControls && !expanded
	const openRateMenuDownward = resolveOpenRateMenuDownward(rateMenuPlacement)

	/** Default ±15s skip when shells do not override skip handlers. */
	function handleSkipBack() {
		if (onSkipBack) {
			onSkipBack()
			return
		}
		onSeek(Math.max(0, liveCurrentSec - PLAYBACK_SKIP_SEC))
	}

	/** Default +15s skip when shells do not override skip handlers. */
	function handleSkipForward() {
		if (onSkipForward) {
			onSkipForward()
			return
		}
		onSeek(Math.min(duration, liveCurrentSec + PLAYBACK_SKIP_SEC))
	}

	/** Toggles the shared rate listbox for both collapsed and expanded chrome. */
	function handleToggleRateMenu() {
		setRateMenuOpen((open) => !open)
	}

	/** Applies the chosen rate and closes the listbox so the row stays compact. */
	function handleSelectRate(playbackRate: number) {
		onPlaybackRateChange(playbackRate)
		setRateMenuOpen(false)
	}

	useEffect(() => {
		if (!expanded) setRateMenuOpen(false)
	}, [expanded])

	useEffect(() => {
		if (scrollSignal > 0) setRateMenuOpen(false)
	}, [scrollSignal])

	useEffect(() => {
		if (!rateMenuOpen) return

		function onDocDown(event: MouseEvent) {
			const el = rateMenuWrapRef.current
			if (el && !el.contains(event.target as Node)) setRateMenuOpen(false)
		}

		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setRateMenuOpen(false)
		}

		document.addEventListener("mousedown", onDocDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDocDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [rateMenuOpen])

	const shellClassName = cn(
		chrome === "outlined"
			? "shrink-0 rounded-2xl border border-border shadow-none"
			: "shrink-0 rounded-2xl shadow-[0px_12px_32px_0px_rgba(0,0,0,0.14)]",
		// Keep a downward-open menu above the following transcript column.
		openRateMenuDownward && rateMenuOpen && "relative z-20",
	)
	// Expanded rate listbox escapes the rounded chrome; the collapsed more menu portals out instead.
	const innerClassName = `rounded-2xl bg-card ${expanded ? "overflow-visible" : "overflow-hidden"}`
	const minimizedControlsClassName = "flex items-center gap-1.5 px-3 py-1.5"
	const expandedControlsClassName = "flex flex-col gap-3 px-3 pb-3.5 pt-3"

	return (
		<div className={shellClassName} data-testid="recording-detail-audio-bar">
			<div className={innerClassName}>
				<audio ref={audioRef} src={audioUrl} preload="metadata" />
				{!expanded ? (
					<div className={minimizedControlsClassName}>
						<button
							type="button"
							onClick={onTogglePlay}
							className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background active:opacity-80"
							aria-label={playing ? t("detail.pause") : t("detail.play")}
							data-testid="recording-detail-player-toggle"
						>
							{playing ? (
								<Pause className="size-4" fill="currentColor" />
							) : (
								<Play className="size-4 pl-0.5" fill="currentColor" />
							)}
						</button>
						<span className="shrink-0 text-[12px] tabular-nums leading-4 text-muted-foreground">
							{formatRecordingTime(liveCurrentSec)} / {formatRecordingTime(duration)}
						</span>
						<div
							className={
								showCollapsedTransport ? "min-w-[48px] flex-1" : "min-w-0 flex-1"
							}
						>
							<LiveAudioWaveformSeek
								durationSec={duration}
								currentSec={liveCurrentSec}
								peakNorms={peakNorms}
								maxBarPx={waveformMaxPx}
								paused={!playing}
								onSeek={onSeek}
								ariaLabel={t("detail.player.waveformSeekAria")}
								seekKeyboardStep={seekKeyboardStep}
								colorSegments={colorSegments}
							/>
						</div>
						{showCollapsedTransport ? (
							<CollapsedTransportMoreMenu
								rate={rate}
								scrollSignal={scrollSignal}
								onSelectRate={handleSelectRate}
								onSkipBack={handleSkipBack}
								onSkipForward={handleSkipForward}
							/>
						) : null}
						<button
							type="button"
							onClick={() => onExpandedChange(true)}
							className={
								showCollapsedTransport
									? COLLAPSED_GHOST_CONTROL_BTN
									: "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-foreground/[0.06]"
							}
							aria-label={t("detail.player.expandPlayerAria")}
						>
							{showCollapsedTransport ? (
								<ExpandPlayerIcon />
							) : (
								<Maximize2 className="size-5 text-foreground" strokeWidth={1.25} />
							)}
						</button>
					</div>
				) : (
					<div className={expandedControlsClassName}>
						<LiveAudioWaveformSeek
							durationSec={duration}
							currentSec={liveCurrentSec}
							peakNorms={peakNorms}
							maxBarPx={waveformMaxPx}
							paused={!playing}
							onSeek={onSeek}
							ariaLabel={t("detail.player.waveformSeekAria")}
							seekKeyboardStep={seekKeyboardStep}
							colorSegments={colorSegments}
						/>
						<div className="flex items-center justify-between text-[13px] tabular-nums text-muted-foreground">
							<span>{formatHMS(liveCurrentSec)}</span>
							<span>{formatHMS(duration)}</span>
						</div>
						<div className="grid w-full grid-cols-5 items-center gap-1 pt-0.5">
							<PlaybackRateMenu
								rate={rate}
								open={rateMenuOpen}
								openDownward={openRateMenuDownward}
								wrapRef={rateMenuWrapRef}
								onToggleOpen={handleToggleRateMenu}
								onSelectRate={handleSelectRate}
							/>
							<div className="flex justify-center">
								<button
									type="button"
									onClick={handleSkipBack}
									className={GHOST_CONTROL_BTN}
									aria-label={t("detail.player.skipBackAria")}
									data-testid="recording-detail-player-skip-back-button"
								>
									<SkipBack15Icon />
								</button>
							</div>
							<div className="flex justify-center">
								<button
									type="button"
									onClick={onTogglePlay}
									className="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground text-background active:opacity-90"
									aria-label={playing ? t("detail.pause") : t("detail.play")}
									data-testid="recording-detail-player-toggle"
								>
									{playing ? (
										<Pause className="size-7" fill="currentColor" />
									) : (
										<Play className="size-7 pl-1" fill="currentColor" />
									)}
								</button>
							</div>
							<div className="flex justify-center">
								<button
									type="button"
									onClick={handleSkipForward}
									className={GHOST_CONTROL_BTN}
									aria-label={t("detail.player.skipForwardAria")}
									data-testid="recording-detail-player-skip-forward-button"
								>
									<SkipForward15Icon />
								</button>
							</div>
							<div className="flex justify-center">
								<button
									type="button"
									onClick={() => onExpandedChange(false)}
									className={GHOST_CONTROL_BTN}
									aria-label={t("detail.player.collapsePlayerAria")}
								>
									<Minimize2 className="size-5" strokeWidth={1.25} />
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

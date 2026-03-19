import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Separator } from "@/components/shadcn-ui/separator"
import { Switch } from "@/components/shadcn-ui/switch"
import { Badge } from "@/components/shadcn-ui/badge"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import magicToast from "@/components/base/MagicToaster/utils"
import type { MediaRecorderConfig } from "@/types/recordSummary"
import type { RecordingDebugPanelProps } from "./types"
import { isDev } from "@/utils/env"

const STREAM_POLL_INTERVAL_MS = 1000

function RecordingDebugPanel({ isOpen = true }: RecordingDebugPanelProps) {
	const { t } = useTranslation("super")
	const [debugStreamInfo, setDebugStreamInfo] = useState<StreamDebugInfo | null>(null)
	const [debugConfig, setDebugConfig] = useState<MediaRecorderConfig | null>(null)
	const [editableConfig, setEditableConfig] = useState<MediaRecorderConfig | null>(null)
	const isDevEnvironment = isDev

	useEffect(() => {
		if (!isDevEnvironment || !isOpen) return
		const recordSummaryService = initializeService()
		const currentConfig = recordSummaryService?.getMediaRecorderConfig?.()
		if (!currentConfig) return
		setDebugConfig(currentConfig)
		setEditableConfig({
			...currentConfig,
			audioSource: currentConfig.audioSource ? { ...currentConfig.audioSource } : undefined,
		})
	}, [isDevEnvironment, isOpen])

	useEffect(() => {
		if (!isDevEnvironment || !isOpen) return
		const recordSummaryService = initializeService()
		const updateStreamInfo = () => {
			const stream = recordSummaryService?.getMediaRecorderStream() || null
			setDebugStreamInfo(buildStreamDebugInfo(stream))
		}

		updateStreamInfo()
		const updateTimer = setInterval(updateStreamInfo, STREAM_POLL_INTERVAL_MS)

		return () => clearInterval(updateTimer)
	}, [isDevEnvironment, isOpen])

	if (!isDevEnvironment || !isOpen) return null

	const handleApplyDebugConfig = () => {
		const recordSummaryService = initializeService()
		if (!recordSummaryService || !editableConfig) return
		recordSummaryService.updateMediaRecorderConfig?.(editableConfig)
		setDebugConfig(editableConfig)
		magicToast.success(t("recordingSummary.debugPanel.applySuccess"))
	}

	const handleResetDebugConfig = () => {
		if (!debugConfig) return
		setEditableConfig({
			...debugConfig,
			audioSource: debugConfig.audioSource ? { ...debugConfig.audioSource } : undefined,
		})
	}

	return (
		<div className="mt-3 rounded-lg bg-card text-foreground">
			<div className="flex flex-col gap-1">
				<div className="text-sm font-semibold">
					{t("recordingSummary.debugPanel.title")}
				</div>
				<div className="text-xs text-muted-foreground">
					{t("recordingSummary.debugPanel.tip")}
				</div>
			</div>

			<Separator className="my-3" />

			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2 text-sm font-medium">
						<span>{t("recordingSummary.debugPanel.streamSection")}</span>
						<Badge variant="secondary">
							{debugStreamInfo?.status === "active"
								? t("recordingSummary.debugPanel.streamActiveBadge")
								: t("recordingSummary.debugPanel.streamInactiveBadge")}
						</Badge>
					</div>
					{debugStreamInfo?.status === "active" ? (
						<div className="space-y-2 text-xs text-muted-foreground">
							<div className="flex items-center justify-between gap-3">
								<span>{t("recordingSummary.debugPanel.streamId")}</span>
								<span className="truncate text-foreground">
									{debugStreamInfo.streamId}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span>{t("recordingSummary.debugPanel.streamActive")}</span>
								<span className="text-foreground">
									{formatBooleanText({
										value: debugStreamInfo.isActive,
										t,
									})}
								</span>
							</div>
							{debugStreamInfo.audioTracks?.map((track) => (
								<div
									key={track.id}
									className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs"
								>
									<div className="space-y-2">
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t("recordingSummary.debugPanel.trackLabel")}
											</span>
											<span className="text-foreground">
												{track.label || "-"}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t("recordingSummary.debugPanel.trackState")}
											</span>
											<span className="text-foreground">
												{track.readyState}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t("recordingSummary.debugPanel.trackEnabled")}
											</span>
											<span className="text-foreground">
												{formatBooleanText({ value: track.enabled, t })}
											</span>
										</div>
										<div className="flex items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{t("recordingSummary.debugPanel.trackMuted")}
											</span>
											<span className="text-foreground">
												{formatBooleanText({ value: track.muted, t })}
											</span>
										</div>
									</div>
									<div className="mt-3 space-y-1">
										{track.settings.length > 0 ? (
											track.settings.map((setting) => (
												<div
													key={`${track.id}-${setting.key}`}
													className="flex items-center justify-between gap-3"
												>
													<span className="text-muted-foreground">
														{t(
															`recordingSummary.debugPanel.settings.${setting.key}`,
														)}
													</span>
													<span className="text-foreground">
														{formatDebugValue({
															value: setting.value,
															t,
														})}
													</span>
												</div>
											))
										) : (
											<div className="text-xs text-muted-foreground">
												{t("recordingSummary.debugPanel.noSettings")}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-xs text-muted-foreground">
							{t("recordingSummary.debugPanel.noStream")}
						</div>
					)}
				</div>

				<Separator />

				<div className="flex flex-col gap-3">
					<div className="text-sm font-medium">
						{t("recordingSummary.debugPanel.configSection")}
					</div>
					{editableConfig ? (
						<div className="flex flex-col gap-3 text-xs">
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.timeslice")}
								</span>
								<Input
									className="h-8 w-28"
									type="number"
									min={1000}
									max={60000}
									step={1000}
									value={editableConfig.timeslice ?? ""}
									onChange={(event) => {
										const value = parseNumberValue(event.target.value)
										if (value === null) return
										setEditableConfig((current) => {
											if (!current) return current
											return {
												...current,
												timeslice: value,
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.audioBitsPerSecond")}
								</span>
								<Input
									className="h-8 w-28"
									type="number"
									min={64000}
									max={512000}
									step={32000}
									value={editableConfig.audioBitsPerSecond ?? ""}
									onChange={(event) => {
										const value = parseNumberValue(event.target.value)
										if (value === null) return
										setEditableConfig((current) => {
											if (!current) return current
											return {
												...current,
												audioBitsPerSecond: value,
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.echoCancellation")}
								</span>
								<Switch
									checked={Boolean(editableConfig.enableEchoCancellation)}
									onCheckedChange={(checked) => {
										setEditableConfig((current) => {
											if (!current) return current
											return {
												...current,
												enableEchoCancellation: checked,
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.noiseSuppression")}
								</span>
								<Switch
									checked={Boolean(editableConfig.enableNoiseSuppression)}
									onCheckedChange={(checked) => {
										setEditableConfig((current) => {
											if (!current) return current
											return {
												...current,
												enableNoiseSuppression: checked,
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.autoGainControl")}
								</span>
								<Switch
									checked={Boolean(editableConfig.autoGainControl)}
									onCheckedChange={(checked) => {
										setEditableConfig((current) => {
											if (!current) return current
											return {
												...current,
												autoGainControl: checked,
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.microphoneGain")}
								</span>
								<Input
									className="h-8 w-28"
									type="number"
									min={0}
									max={3}
									step={0.1}
									value={editableConfig.audioSource?.microphoneGain ?? ""}
									onChange={(event) => {
										const value = parseNumberValue(event.target.value)
										if (value === null) return
										setEditableConfig((current) => {
											if (!current) return current
											const source =
												current.audioSource?.source ?? "microphone"
											return {
												...current,
												audioSource: {
													...current.audioSource,
													source,
													microphoneGain: value,
												},
											}
										})
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground">
									{t("recordingSummary.debugPanel.systemGain")}
								</span>
								<Input
									className="h-8 w-28"
									type="number"
									min={0}
									max={3}
									step={0.1}
									value={editableConfig.audioSource?.systemGain ?? ""}
									onChange={(event) => {
										const value = parseNumberValue(event.target.value)
										if (value === null) return
										setEditableConfig((current) => {
											if (!current) return current
											const source =
												current.audioSource?.source ?? "microphone"
											return {
												...current,
												audioSource: {
													...current.audioSource,
													source,
													systemGain: value,
												},
											}
										})
									}}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
								<Button size="sm" onClick={handleApplyDebugConfig}>
									{t("recordingSummary.debugPanel.apply")}
								</Button>
								<Button
									size="sm"
									variant="secondary"
									onClick={handleResetDebugConfig}
								>
									{t("recordingSummary.debugPanel.reset")}
								</Button>
								<span>{t("recordingSummary.debugPanel.applyHint")}</span>
							</div>
						</div>
					) : (
						<div className="text-xs text-muted-foreground">
							{t("recordingSummary.debugPanel.noConfig")}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

function buildStreamDebugInfo(stream: MediaStream | null): StreamDebugInfo {
	if (!stream) {
		return {
			status: "inactive",
		}
	}

	const audioTracks = stream.getAudioTracks()
	return {
		status: "active",
		streamId: stream.id,
		isActive: stream.active,
		audioTracks: audioTracks.map((track) => ({
			id: track.id,
			label: track.label,
			readyState: track.readyState,
			enabled: track.enabled,
			muted: track.muted,
			settings: buildTrackSettings(track),
		})),
	}
}

function buildTrackSettings(track: MediaStreamTrack): StreamSettingItem[] {
	const settings = track.getSettings ? track.getSettings() : {}
	const entries: StreamSettingItem[] = [
		{ key: "sampleRate", value: settings.sampleRate },
		{ key: "channelCount", value: settings.channelCount },
		{ key: "echoCancellation", value: settings.echoCancellation },
		{ key: "noiseSuppression", value: settings.noiseSuppression },
		{ key: "autoGainControl", value: settings.autoGainControl },
		{ key: "deviceId", value: settings.deviceId },
	]
	return entries.filter((entry) => entry.value !== undefined)
}

function formatDebugValue({ value, t }: { value: unknown; t: (key: string) => string }): string {
	if (typeof value === "boolean") {
		return value
			? t("recordingSummary.debugPanel.booleanTrue")
			: t("recordingSummary.debugPanel.booleanFalse")
	}
	if (value === null || value === undefined || value === "") {
		return t("recordingSummary.debugPanel.booleanUnknown")
	}
	return String(value)
}

function formatBooleanText({ value, t }: { value?: boolean; t: (key: string) => string }): string {
	if (value === undefined) return t("recordingSummary.debugPanel.booleanUnknown")
	return value
		? t("recordingSummary.debugPanel.booleanTrue")
		: t("recordingSummary.debugPanel.booleanFalse")
}

function parseNumberValue(value: string): number | null {
	if (value.trim() === "") return null
	const parsedValue = Number(value)
	if (Number.isNaN(parsedValue)) return null
	return parsedValue
}

interface StreamSettingItem {
	key:
	| "sampleRate"
	| "channelCount"
	| "echoCancellation"
	| "noiseSuppression"
	| "autoGainControl"
	| "deviceId"
	value: unknown
}

interface StreamDebugInfo {
	status: "active" | "inactive"
	streamId?: string
	isActive?: boolean
	audioTracks?: AudioTrackDebugInfo[]
}

interface AudioTrackDebugInfo {
	id: string
	label: string
	readyState: MediaStreamTrackState
	enabled: boolean
	muted: boolean
	settings: StreamSettingItem[]
}

export { RecordingDebugPanel }

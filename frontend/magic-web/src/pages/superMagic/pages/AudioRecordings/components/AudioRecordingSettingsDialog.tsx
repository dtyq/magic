import { useCallback, useEffect, useState } from "react"
import dayjs from "dayjs"
import { useTranslation } from "react-i18next"
import { AlertCircle, CheckCircle2, Loader2, Monitor, RefreshCw, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import { Switch } from "@/components/shadcn-ui/switch"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import LanguageModelSwitch from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/LanguageModelSwitch"
import { useRecordingSettings } from "../hooks/useRecordingSettings"
import {
	checkRecordingHealth,
	reportRecordingHealthCheck,
	type RecordingHealthCheckResult,
} from "../utils/recording-health-check"

interface AudioRecordingSettingsDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/**
 * Settings modal for PC recording preferences.
 * Implements a clean, flat form list matching user preferences styling,
 * and embeds LanguageModelSwitch for model selection.
 */
export function AudioRecordingSettingsDialog({
	open,
	onOpenChange,
}: AudioRecordingSettingsDialogProps) {
	const { t } = useTranslation(["super", "audioRecordings"])
	const [healthResult, setHealthResult] = useState<RecordingHealthCheckResult | null>(null)
	const [isCheckingHealth, setIsCheckingHealth] = useState(false)

	// Load settings, models and current selected model via hook
	const {
		settings,
		summaryModels,
		summaryModelGroups,
		selectedModel,
		isLoading,
		isSaving,
		updateSetting,
	} = useRecordingSettings({ enabled: open })

	// Show loading spinner when settings are loading
	const shouldShowLoading =
		!settings || (isLoading && summaryModelGroups.length === 0 && summaryModels.length === 0)

	/**
	 * Handles model selection changes and updates the backend topic settings
	 */
	const handleModelSelect = async (modelId: string) => {
		if (isSaving || !settings) return
		await updateSetting("model_id", modelId)
	}

	const runHealthCheck = useCallback((shouldReport: boolean) => {
		setIsCheckingHealth(true)
		try {
			const result = checkRecordingHealth()
			setHealthResult(result)
			if (shouldReport) reportRecordingHealthCheck(result)
		} finally {
			setIsCheckingHealth(false)
		}
	}, [])

	useEffect(() => {
		if (open) runHealthCheck(false)
	}, [open, runHealthCheck])

	const formatCheckedAt = (timestamp: number) => dayjs(timestamp).format("YYYY/MM/DD HH:mm:ss")

	const healthItems = healthResult
		? [
				{
					key: "secureContext",
					label: t(
						"super:mobile.recordingEntry.settings.healthCheck.items.secureContext",
					),
					supported: healthResult.isSecureContext,
				},
				{
					key: "getUserMedia",
					label: t("super:mobile.recordingEntry.settings.healthCheck.items.getUserMedia"),
					supported: healthResult.hasGetUserMedia,
				},
				{
					key: "audioContext",
					label: t("super:mobile.recordingEntry.settings.healthCheck.items.audioContext"),
					supported: healthResult.hasAudioContext,
				},
				{
					key: "audioWorklet",
					label: t("super:mobile.recordingEntry.settings.healthCheck.items.audioWorklet"),
					supported: healthResult.hasAudioWorklet && healthResult.hasAudioWorkletNode,
				},
				{
					key: "processingMode",
					label: t(
						"super:mobile.recordingEntry.settings.healthCheck.items.processingMode",
					),
					supported: true,
					value: t(
						`super:mobile.recordingEntry.settings.healthCheck.processingModes.${healthResult.processingMode}`,
					),
				},
			]
		: []

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[480px]"
				data-testid="audio-recording-settings-dialog"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5 text-foreground" />
						<span>{t("super:mobile.recordingEntry.settings.title")}</span>
					</DialogTitle>
				</DialogHeader>

				{shouldShowLoading ? (
					<div className="flex h-40 items-center justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="flex flex-col px-1">
						{/* Row 1: Auto Transcription Switch */}
						<div className="flex items-start justify-between gap-4 border-b border-border py-4">
							<div className="flex flex-col gap-1">
								<span className="text-sm font-medium text-foreground">
									{t(
										"super:mobile.recordingEntry.settings.transcriptionEnabled.label",
									)}
								</span>
								<span className="max-w-[280px] text-xs leading-normal text-muted-foreground">
									{t(
										"super:mobile.recordingEntry.settings.transcriptionEnabled.description",
									)}
								</span>
							</div>
							<Switch
								checked={settings.transcription_enabled}
								onCheckedChange={(checked) => {
									// Match mobile: use isSaving as a logic lock only, not disabled UI,
									// so other rows stay visually stable while one setting persists.
									if (isSaving) return
									void updateSetting("transcription_enabled", checked)
								}}
								data-testid="recording-setting-transcription-enabled"
							/>
						</div>

						{/* Row 2: Auto Summary Switch */}
						<div className="flex items-start justify-between gap-4 border-b border-border py-4">
							<div className="flex flex-col gap-1">
								<span className="text-sm font-medium text-foreground">
									{t(
										"super:mobile.recordingEntry.settings.autoSummaryEnabled.label",
									)}
								</span>
								<span className="max-w-[280px] text-xs leading-normal text-muted-foreground">
									{t(
										"super:mobile.recordingEntry.settings.autoSummaryEnabled.description",
									)}
								</span>
							</div>
							<Switch
								checked={settings.auto_summary_enabled}
								onCheckedChange={(checked) => {
									if (isSaving) return
									void updateSetting("auto_summary_enabled", checked)
								}}
								data-testid="recording-setting-auto-summary-enabled"
							/>
						</div>

						{/* Row 3: AI Model Selector (using LanguageModelSwitch) */}
						<div className="flex items-center justify-between gap-4 py-4">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium text-foreground">
									{t("super:mobile.recordingEntry.settings.model.label")}
								</span>
								<span className="text-xs leading-normal text-muted-foreground">
									{t("super:mobile.recordingEntry.settings.model.description")}
								</span>
							</div>
							<div className="flex w-[180px] justify-end">
								<LanguageModelSwitch
									size="small"
									selectedModel={selectedModel}
									modelList={summaryModelGroups}
									onModelChange={(model) =>
										void handleModelSelect(model?.model_id ?? "")
									}
									showName
									showBorder
									placement="bottom"
									className="h-9 w-[180px] justify-between px-3"
								/>
							</div>
						</div>

						<div
							className="border-t border-border py-4"
							data-testid="recording-health-check"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex flex-col gap-1">
									<span className="text-sm font-medium text-foreground">
										{t(
											"super:mobile.recordingEntry.settings.healthCheck.title",
										)}
									</span>
									<span className="max-w-[300px] text-xs leading-normal text-muted-foreground">
										{t(
											"super:mobile.recordingEntry.settings.healthCheck.description",
										)}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={isCheckingHealth}
									onClick={() => runHealthCheck(true)}
									aria-label={t(
										"super:mobile.recordingEntry.settings.healthCheck.button",
									)}
									data-testid="recording-health-check-button"
								>
									{isCheckingHealth ? (
										<Loader2 className="animate-spin" />
									) : (
										<RefreshCw />
									)}
									{isCheckingHealth
										? t(
												"super:mobile.recordingEntry.settings.healthCheck.checking",
											)
										: t(
												"super:mobile.recordingEntry.settings.healthCheck.button",
											)}
								</Button>
							</div>

							{healthResult && (
								<div
									className="mt-3 rounded-md bg-muted/40 p-3"
									role="status"
									aria-live="polite"
								>
									<div className="flex items-center justify-between gap-2">
										<div className="flex items-center gap-2 text-sm font-medium">
											{healthResult.overallStatus === "supported" ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-600" />
											) : healthResult.overallStatus === "partial" ? (
												<AlertCircle className="h-4 w-4 text-amber-600" />
											) : (
												<AlertCircle className="h-4 w-4 text-destructive" />
											)}
											<span>
												{t(
													`super:mobile.recordingEntry.settings.healthCheck.status.${healthResult.overallStatus}`,
												)}
											</span>
										</div>
										<span
											className="text-[11px] text-muted-foreground"
											data-testid="recording-health-check-time"
										>
											{formatCheckedAt(healthResult.checkedAt)}
										</span>
									</div>
									<div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
										{healthItems.map((item) => (
											<div
												className="flex items-center gap-1.5"
												key={item.key}
											>
												{item.supported ? (
													<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
												) : (
													<AlertCircle className="h-3.5 w-3.5 text-destructive" />
												)}
												<span
													className={cn(
														!item.supported && "text-destructive",
													)}
												>
													{item.label}:{" "}
													{item.value ??
														(item.supported
															? t(
																	"super:mobile.recordingEntry.settings.healthCheck.supported",
																)
															: t(
																	"super:mobile.recordingEntry.settings.healthCheck.unsupported",
																))}
												</span>
											</div>
										))}
									</div>
									<div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
										<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
											<Monitor className="h-3.5 w-3.5" aria-hidden="true" />
										</div>
										<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
											<span className="text-[11px] font-medium text-muted-foreground">
												{t(
													"super:mobile.recordingEntry.settings.healthCheck.environment",
												)}
											</span>
											<span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-border/70">
												{healthResult.browserName}{" "}
												{healthResult.browserVersion || "?"}
											</span>
											<span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border/70">
												{healthResult.platform}
											</span>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}

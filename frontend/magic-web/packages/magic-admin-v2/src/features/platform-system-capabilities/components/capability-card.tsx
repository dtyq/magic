import {
	Bot,
	Cpu,
	Eye,
	FileText,
	Image,
	Search,
	Sparkles,
	Volume2,
	type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Card, CardContent } from "@magic-admin-v2/components/ui/card"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import {
	aiPowerCode,
	aiPowerStatus,
	type AiPower,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import { getCapabilityDisplayText } from "@magic-admin-v2/features/platform-system-capabilities/utils"
import { memo } from "react"

const capabilityIconMap: Partial<Record<string, LucideIcon>> = {
	[aiPowerCode.webSearch]: Search,
	[aiPowerCode.webScrape]: FileText,
	[aiPowerCode.imageSearch]: Image,
	[aiPowerCode.imageConvertHigh]: Image,
	[aiPowerCode.imageExpand]: Image,
	[aiPowerCode.imageRemoveBackground]: Image,
	[aiPowerCode.imageEraser]: Image,
	[aiPowerCode.realtimeSpeechRecognition]: Volume2,
	[aiPowerCode.audioFileRecognition]: Volume2,
	[aiPowerCode.autoCompletion]: Sparkles,
	[aiPowerCode.contentSummary]: FileText,
	[aiPowerCode.visualUnderstanding]: Eye,
	[aiPowerCode.ocr]: FileText,
	[aiPowerCode.weatherForecast]: Cpu,
	[aiPowerCode.superMagicDeepWrite]: Bot,
	[aiPowerCode.superMagicPurify]: Bot,
	[aiPowerCode.superMagicSmartFilename]: Bot,
	[aiPowerCode.superMagicCompact]: Bot,
	[aiPowerCode.superMagicAnalysisAudio]: Bot,
}

export const CapabilityCard = memo(function CapabilityCard({
	cardTestId,
	canEdit,
	configButtonTestId,
	item,
	onConfig,
	onStatusChange,
	statusSwitchTestId,
	statusPending,
}: {
	cardTestId?: string
	canEdit: boolean
	configButtonTestId?: string
	item: AiPower
	onConfig: (item: AiPower) => void
	onStatusChange: (item: AiPower, checked: boolean) => void
	statusSwitchTestId?: string
	statusPending: boolean
}) {
	const { t } = useTranslation()
	const Icon = capabilityIconMap[item.code] ?? Cpu
	const enabled = item.status === aiPowerStatus.enabled
	const displayName = getCapabilityDisplayText(item.name)
	const displayDescription = getCapabilityDisplayText(item.description)

	return (
		<Card className="h-full overflow-hidden border-border/50 py-0" data-testid={cardTestId}>
			<CardContent className="flex h-full flex-col gap-4 p-4">
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
						<Icon className="size-5 text-muted-foreground" aria-hidden="true" />
					</div>
					<div className="min-w-0 space-y-1">
						<h2 className="min-w-0 truncate text-base font-semibold">
							{displayName || t("common.emptyValue")}
						</h2>
						<CopyableValue className="max-w-full" value={item.code} />
					</div>
				</div>

				<p className="text-sm text-muted-foreground">
					{displayDescription || t("common.emptyValue")}
				</p>

				<div className="mt-auto flex border-t pt-4 flex-row items-center justify-between">
					<div className="flex items-center gap-2">
						<Switch
							checked={enabled}
							data-testid={statusSwitchTestId}
							disabled={!canEdit || statusPending}
							onCheckedChange={(checked) => onStatusChange(item, checked)}
						/>
						<span className="whitespace-nowrap text-sm text-muted-foreground">
							{enabled ? t("common.enabled") : t("common.disabled")}
						</span>
					</div>
					<Button
						className="shrink-0"
						data-testid={configButtonTestId}
						disabled={!canEdit}
						onClick={() => onConfig(item)}
						size="sm"
						variant="outline"
					>
						{t("systemCapabilities.action.config")}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
})

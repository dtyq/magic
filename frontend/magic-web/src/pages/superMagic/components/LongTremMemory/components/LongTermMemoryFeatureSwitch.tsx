import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Switch } from "@/components/shadcn-ui/switch"
import { useLongTermMemoryPreference } from "@/hooks/useLongTermMemoryPreference"

/** 长期记忆页面内的用户级自动功能开关。 */
export const LongTermMemoryFeatureSwitch = memo(function LongTermMemoryFeatureSwitch() {
	const { t } = useTranslation("super/longMemory")
	const { enabled, isLoading, setEnabled } = useLongTermMemoryPreference()
	const [isSaving, setIsSaving] = useState(false)

	/** 保存开关状态，并在失败时保留服务端已确认的原状态。 */
	const handleCheckedChange = async (checked: boolean) => {
		setIsSaving(true)
		try {
			await setEnabled(checked)
			magicToast.success(
				checked ? t("featureSwitch.enableSuccess") : t("featureSwitch.disableSuccess"),
			)
		} catch (error) {
			console.error("保存长期记忆开关失败", error)
			magicToast.error(t("featureSwitch.saveFailed"))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-5 py-3">
			<div className="min-w-0">
				<div className="text-sm font-medium">{t("featureSwitch.title")}</div>
				<div className="mt-0.5 text-xs text-muted-foreground">
					{t("featureSwitch.description")}
				</div>
			</div>
			<Switch
				checked={enabled}
				disabled={isLoading || isSaving}
				loading={isLoading || isSaving}
				onCheckedChange={(checked) => void handleCheckedChange(checked)}
				aria-label={t("featureSwitch.title")}
			/>
		</div>
	)
})

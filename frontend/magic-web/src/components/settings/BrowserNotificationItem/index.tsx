import { useMemoizedFn } from "ahooks"
import { ExternalLink } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import { Switch } from "@/components/shadcn-ui/switch"
import SettingItem from "@/components/settings/SettingItem"
import {
	browserNotificationPreference,
	browserNotificationService,
} from "@/services/browserNotification"

interface BrowserNotificationItemProps {
	mobile?: boolean
}

function BrowserNotificationItem({ mobile = false }: BrowserNotificationItemProps) {
	const { t } = useTranslation("interface")
	const [enabled, setEnabled] = useState(false)
	const [checking, setChecking] = useState(false)

	const systemSettingsUrl = useMemo(
		() => browserNotificationService.getSystemNotificationSettingsUrl(),
		[],
	)

	const openSystemSettingsUrl = useMemoizedFn((url: string) => {
		window.location.href = url
	})

	const disableNotification = useMemoizedFn(() => {
		browserNotificationPreference.setEnabled(false)
		setEnabled(false)
	})

	const handleChange = useMemoizedFn(async (checked: boolean) => {
		if (!checked) {
			disableNotification()
			return
		}

		setChecking(true)
		const permissionEnabled = await browserNotificationService
			.ensurePermissionEnabled()
			.catch(() => false)
		setChecking(false)

		if (permissionEnabled) {
			browserNotificationPreference.setEnabled(true)
			setEnabled(true)
			toast.success(t("setting.browserNotificationEnabledToast"))
			return
		}

		disableNotification()
		toast.error(t("setting.browserNotificationPermissionDeniedToast"))
	})

	useEffect(() => {
		setEnabled(browserNotificationPreference.getEnabled())
	}, [])

	if (mobile) {
		return (
			<div className="flex w-full flex-col gap-2 px-2 py-2.5">
				<div className="flex w-full items-center gap-2">
					<div className="flex-1 text-left text-sm text-foreground">
						{t("setting.browserNotification")}
					</div>
					<Switch checked={enabled} disabled={checking} onCheckedChange={handleChange} />
				</div>
				<div className="text-xs leading-5 text-muted-foreground">
					<div>{t("setting.browserNotificationDescription")}</div>
					<div>
						{enabled
							? t("setting.browserNotificationSystemTip")
							: t("setting.browserNotificationPermissionTip")}
					</div>
				</div>
				{systemSettingsUrl && (
					<div className="flex">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => openSystemSettingsUrl(systemSettingsUrl)}
						>
							<ExternalLink className="size-3.5" />
							{t("setting.openSystemNotificationSettings")}
						</Button>
					</div>
				)}
			</div>
		)
	}

	return (
		<SettingItem
			title={t("setting.browserNotification")}
			description={
				<div className="flex flex-col gap-2">
					<div>{t("setting.browserNotificationDescription")}</div>
					<div>
						{enabled
							? t("setting.browserNotificationSystemTip")
							: t("setting.browserNotificationPermissionTip")}
					</div>
					<div className="flex flex-wrap gap-2">
						{systemSettingsUrl && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => openSystemSettingsUrl(systemSettingsUrl)}
							>
								<ExternalLink className="size-3.5" />
								{t("setting.openSystemNotificationSettings")}
							</Button>
						)}
					</div>
				</div>
			}
			extra={<Switch checked={enabled} disabled={checking} onCheckedChange={handleChange} />}
			adaptMobile
		/>
	)
}

export default memo(BrowserNotificationItem)

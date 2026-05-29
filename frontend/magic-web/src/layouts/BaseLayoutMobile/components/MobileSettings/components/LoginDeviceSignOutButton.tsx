import { LogOut } from "lucide-react"
import { useTranslation } from "react-i18next"

interface LoginDeviceSignOutButtonProps {
	onClick: () => void
	dataTestId?: string
}

/** 登录设备行右侧「退出」按钮，样式与原型 LoginDevicesSheet 逐字对齐，避免 shadcn Button 基类污染间距与阴影。 */
export function LoginDeviceSignOutButton({
	onClick,
	dataTestId = "mobile-settings-login-device-logout-button",
}: LoginDeviceSignOutButtonProps) {
	const { t } = useTranslation("interface")

	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-transparent px-3 text-[13px] font-medium leading-5 text-destructive transition-colors active:bg-destructive/10"
			data-testid={dataTestId}
		>
			<LogOut className="mr-1 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
			{t("setting.loginDevices.logout")}
		</button>
	)
}

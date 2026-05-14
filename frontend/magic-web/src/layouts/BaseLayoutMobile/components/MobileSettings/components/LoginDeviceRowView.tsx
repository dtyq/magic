import type { ComponentType, SVGProps } from "react"
import { Globe, Laptop, LogOut, MonitorSmartphone, Smartphone, Tablet } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import type { User } from "@/types/user"

interface LoginDeviceRowViewProps {
	device: User.UserDeviceInfo
	isCurrent: boolean
	system: string
	timeLabel: string
	showDivider: boolean
	onLogout: (deviceId: string) => void
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** 设置登录设备专用展示行只处理 UI 与事件分发，避免新浮窗继续耦合旧路由组件。 */
export function LoginDeviceRowView({
	device,
	isCurrent,
	system,
	timeLabel,
	showDivider,
	onLogout,
}: LoginDeviceRowViewProps) {
	const { t } = useTranslation("interface")
	const Icon = getDeviceIcon(device.os)

	return (
		<>
			<div
				className="flex w-full items-start gap-3 bg-popover px-3.5 py-3"
				data-testid="mobile-settings-login-device-row"
			>
				<div
					className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted"
					aria-hidden
				>
					<Icon className="size-5 text-foreground" strokeWidth={1.75} />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex min-w-0 items-center gap-1.5">
						<p className="truncate text-[15px] font-medium leading-5 text-foreground">
							{device.device_name || t("setting.unknownDevice")}
						</p>
						{isCurrent ? (
							<span className="inline-flex h-[18px] shrink-0 items-center rounded bg-primary/10 px-1.5 text-[10px] font-medium leading-none text-primary">
								{t("setting.currentDevices")}
							</span>
						) : null}
					</div>
					<p className="truncate text-xs leading-4 text-muted-foreground">
						{system || t("common.unknown")}
					</p>
					<p className="truncate text-xs leading-4 text-muted-foreground">{timeLabel}</p>
				</div>
				{!isCurrent ? (
					<Button
						type="button"
						variant="outline"
						onClick={() => onLogout(device.id)}
						className="mt-0.5 h-8 shrink-0 rounded-full border-destructive/30 bg-transparent px-3 text-[13px] font-medium leading-5 text-destructive active:bg-destructive/10"
						data-testid="mobile-settings-login-device-logout-button"
					>
						<LogOut className="mr-1 size-3.5" aria-hidden />
						{t("setting.loginDevices.logout")}
					</Button>
				) : null}
			</div>
			{showDivider ? <div className="ml-3.5 h-px bg-border" aria-hidden /> : null}
		</>
	)
}

/** 后端未提供设备类型时，根据系统名称做展示级图标推断，不参与业务判断。 */
function getDeviceIcon(os?: string): IconComponent {
	if (!os) return MonitorSmartphone

	const normalizedOs = os.toLowerCase()
	if (normalizedOs.includes("iphone") || normalizedOs.includes("android")) return Smartphone
	if (normalizedOs.includes("ipad") || normalizedOs.includes("tablet")) return Tablet
	if (normalizedOs.includes("web")) return Globe
	if (
		normalizedOs.includes("mac") ||
		normalizedOs.includes("windows") ||
		normalizedOs.includes("linux")
	)
		return Laptop

	return MonitorSmartphone
}

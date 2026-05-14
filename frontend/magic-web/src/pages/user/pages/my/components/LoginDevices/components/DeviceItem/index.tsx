import type { ComponentType, SVGProps } from "react"
import { useTranslation } from "react-i18next"
import { Globe, Laptop, LogOut, Monitor, MonitorSmartphone, Smartphone, Tablet } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface DeviceItemProps {
	deviceId: string
	name: string
	variant?: "legacy" | "mobile"
	os?: string
	system?: string
	time?: string
	timeLabel?: string
	isCurrent?: boolean
	showDivider?: boolean
	onLogout?: (deviceId: string) => void
}

interface DeviceIconProps {
	os?: string
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** 单条设备行只处理视觉呈现和退出按钮事件分发，业务确认留给上层 hook。 */
function DeviceItem({
	name,
	variant = "legacy",
	os,
	system,
	time,
	timeLabel,
	isCurrent = false,
	showDivider = false,
	deviceId,
	onLogout,
}: DeviceItemProps) {
	const { t } = useTranslation("interface")
	const displayTimeLabel = timeLabel ?? time ?? t("common.unknown")

	if (variant === "legacy")
		return (
			<LegacyDeviceItem
				deviceId={deviceId}
				name={name}
				system={system}
				time={displayTimeLabel}
				isCurrent={isCurrent}
				onLogout={onLogout}
			/>
		)

	return (
		<>
			<div
				className="flex w-full items-start gap-3 bg-popover px-[14px] py-3"
				data-testid="login-devices-device-row"
			>
				<DeviceIcon os={os} />

				{/* 文本区保留多行信息，避免设备名过长时挤压右侧退出按钮。 */}
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex min-w-0 items-center gap-1.5">
						<p className="truncate text-[15px] font-medium leading-5 text-foreground">
							{name || t("setting.unknownDevice")}
						</p>
						{isCurrent ? (
							<span
								className="inline-flex h-[18px] shrink-0 items-center rounded bg-primary/10 px-1.5 text-[10px] font-medium leading-none text-primary"
								data-testid="login-devices-current-badge"
							>
								{t("setting.currentDevices")}
							</span>
						) : null}
					</div>
					<p className="truncate text-xs leading-4 text-muted-foreground">
						{system || t("common.unknown")}
					</p>
					<p className="truncate text-xs leading-4 text-muted-foreground">
						{displayTimeLabel}
					</p>
				</div>

				{!isCurrent ? (
					<Button
						variant="outline"
						onClick={() => onLogout?.(deviceId)}
						className="mt-0.5 h-8 shrink-0 rounded-full border-destructive/30 bg-transparent px-3 text-[13px] font-medium leading-5 text-destructive active:bg-destructive/10"
						data-testid="login-devices-device-logout-button"
					>
						<LogOut className="mr-1 size-3.5" aria-hidden />
						{t("setting.loginDevices.logout")}
					</Button>
				) : null}
			</div>
			{showDivider ? <div className="ml-[14px] h-px w-full bg-border" /> : null}
		</>
	)
}

interface LegacyDeviceItemProps {
	deviceId: string
	name: string
	system?: string
	time: string
	isCurrent: boolean
	onLogout?: (deviceId: string) => void
}

/** 旧版账户设置页仍复用该组件，默认分支保留原有桌面/企业版视觉形态。 */
function LegacyDeviceItem({
	name,
	system,
	time,
	isCurrent,
	deviceId,
	onLogout,
}: LegacyDeviceItemProps) {
	const { t } = useTranslation("interface")

	return (
		<div className="flex w-full items-center gap-2 bg-popover p-3 [&:first-child]:rounded-t-md [&:last-child]:rounded-b-md [&:not(:last-child)]:border-b [&:not(:last-child)]:border-none">
			{/* 设备图标沿用旧版蓝紫渐变背景，避免影响非移动端设置页。 */}
			<div
				className="flex size-10 shrink-0 items-center justify-center rounded-md"
				style={{
					backgroundImage:
						"linear-gradient(90deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.8) 100%), linear-gradient(90deg, rgba(99, 102, 241, 1) 0%, rgba(99, 102, 241, 1) 100%)",
				}}
			>
				<Monitor className="size-6 text-indigo-500" />
			</div>

			<div className="flex flex-1 flex-col items-start justify-center gap-0.5 self-stretch">
				<p className="text-sm font-medium leading-5 text-foreground">
					{name ?? t("setting.unknownDevice")}
				</p>
				<p className="text-xs leading-4 text-muted-foreground">
					{t("setting.system")}：{system ?? t("common.unknown")}
				</p>
				<p className="text-xs leading-4 text-muted-foreground">
					{t("setting.loginTime")}：{time}
				</p>
			</div>

			{isCurrent ? (
				<Button
					variant="ghost"
					disabled
					className="h-9 gap-2 bg-transparent px-3 py-2 opacity-50"
				>
					<div className="whitespace-nowrap text-sm font-normal leading-5 text-foreground">
						{t("setting.currentDevices")}
					</div>
				</Button>
			) : (
				<Button
					variant="outline"
					onClick={() => onLogout?.(deviceId)}
					className="h-8 gap-2 border border-input bg-fill px-3 py-0 text-sm font-normal leading-5 text-foreground"
				>
					{t("setting.loginDevices.logout")}
				</Button>
			)}
		</div>
	)
}

/** 根据系统名称选择设备图标，后端未提供设备类型时用系统字符串做保守推断。 */
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

/** 设备图标块使用弱背景承载图形，保持列表扫描时的视觉锚点。 */
function DeviceIcon({ os }: DeviceIconProps) {
	const Icon = getDeviceIcon(os)

	return (
		<div
			className="mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted"
			aria-hidden
		>
			<Icon className="size-5 text-foreground" strokeWidth={1.75} />
		</div>
	)
}

export default DeviceItem

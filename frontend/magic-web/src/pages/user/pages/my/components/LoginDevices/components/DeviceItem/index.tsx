import { useTranslation } from "react-i18next"
import { Monitor } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"

interface DeviceItemProps {
	deviceId: string
	name: string
	type?: "pc" | "mobile"
	system?: string
	time: string
	isCurrent?: boolean
	onLogout?: (deviceId: string) => void
}

function DeviceItem({
	name,
	system,
	time,
	isCurrent = false,
	deviceId,
	onLogout,
}: DeviceItemProps) {
	const { t } = useTranslation("interface")

	return (
		<div className="flex w-full items-center gap-2 bg-popover p-3 [&:first-child]:rounded-t-md [&:last-child]:rounded-b-md [&:not(:last-child)]:border-b [&:not(:last-child)]:border-none">
			{/* 设备图标 */}
			<div
				className="flex size-10 shrink-0 items-center justify-center rounded-md"
				style={{
					backgroundImage:
						"linear-gradient(90deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.8) 100%), linear-gradient(90deg, rgba(99, 102, 241, 1) 0%, rgba(99, 102, 241, 1) 100%)",
				}}
			>
				<Monitor className="size-6 text-indigo-500" />
			</div>

			{/* 设备信息 */}
			<div className="flex flex-1 flex-col items-start justify-center gap-0.5 self-stretch">
				<p className="text-sm font-medium leading-5 text-foreground">
					{name ?? t("setting.unknownDevice")}
				</p>
				<p className="text-xs leading-4 text-muted-foreground">
					{t("setting.system")}：{system ?? t("common.unknown")}
				</p>
				<p className="text-xs leading-4 text-muted-foreground">
					{t("setting.loginTime")}：{time ?? t("common.unknown")}
				</p>
			</div>

			{/* 登出按钮或当前标签 */}
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

export default DeviceItem

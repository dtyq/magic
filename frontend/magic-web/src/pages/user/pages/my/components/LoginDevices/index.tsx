import { useState } from "react"
import { ChevronLeft, Shield } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn, useMount } from "ahooks"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { Button } from "@/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import { useUserDevices } from "@/models/user/hooks"
import { useDeviceLogout } from "./hooks/useDeviceLogout"
import MagicSpin from "@/components/base/MagicSpin"
import DeviceItem from "./components/DeviceItem"
import LogoutConfirmModal from "./components/LogoutConfirmModal"
import { getDeviceInfo } from "@/utils/devices"
import { MagicEmpty } from "@/components/base"

function LoginDevices() {
	const { i18n, t } = useTranslation("accountSetting")
	const navigate = useNavigate()

	// Data fetching
	const { data: devices, isLoading, mutate } = useUserDevices()

	// Device logout logic
	const { state, handlers } = useDeviceLogout(devices || [], mutate)

	const [currentDevice, setCurrentDevice] = useState<string | null>(null)

	useMount(() => {
		getDeviceInfo(i18n).then((res) => {
			setCurrentDevice(res.id)
		})
	})

	// 返回上一页
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				type: "slide",
				direction: "right",
			},
		})
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">{t("loginDevices")}</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex w-full flex-1 flex-col gap-4 overflow-hidden px-3.5 pb-safe-bottom-with-tabbar">
				{/* 提示信息 */}
				<div
					className="flex gap-1 rounded-lg px-3 py-2 text-sm text-foreground-blue"
					style={{
						background:
							"linear-gradient(0deg, rgba(255, 255, 255, 0.90) 0%, rgba(255, 255, 255, 0.90) 100%), #3B82F6",
					}}
				>
					<Shield className="size-5" />
					<div>{t("setting.tip.loginDevicesTip", { ns: "interface" })}</div>
				</div>

				{/* 设备列表 */}
				<MagicSpin className="min-h-0 flex-1" spinning={isLoading}>
					{devices?.length === 0 ? (
						<div className="flex h-full items-center justify-center">
							<MagicEmpty description={t("noData")} />
						</div>
					) : (
						<div className="flex h-full flex-col gap-[1px] overflow-y-auto">
							{devices?.map((item) => {
								return (
									<DeviceItem
										key={item.id}
										deviceId={item.id}
										name={item.device_name}
										system={
											item.os ? `${item.os} ${item.os_version}` : undefined
										}
										time={item.updated_at}
										isCurrent={currentDevice === item.device_id}
										onLogout={handlers.handleLogout}
									/>
								)
							})}
						</div>
					)}
				</MagicSpin>
			</div>

			{/* Logout Confirm Modal */}
			<LogoutConfirmModal
				open={state.isModalOpen}
				onCancel={handlers.handleCancel}
				onTrigger={handlers.handleTrigger}
				onInputComplete={handlers.handleInputComplete}
			/>
		</div>
	)
}

export default observer(LoginDevices)

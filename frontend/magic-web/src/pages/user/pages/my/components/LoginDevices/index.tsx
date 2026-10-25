import { useMemo, useState } from "react"
import { ChevronLeft, Shield } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn, useMount } from "ahooks"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useTranslation } from "react-i18next"
import { useUserDevices } from "@/models/user/hooks"
import { useDeviceLogout } from "./hooks/useDeviceLogout"
import MagicSpin from "@/components/base/MagicSpin"
import DeviceItem from "./components/DeviceItem"
import LogoutConfirmModal from "./components/LogoutConfirmModal"
import { getDeviceInfo } from "@/utils/devices"
import { MagicEmpty } from "@/components/base"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import dayjs from "@/infrastructure/vendors/dayjs"
import type { User } from "@/types/user"
import type { TFunction } from "i18next"

/** Assemble device data, current-device identity and logout confirmation at the page boundary. */
function LoginDevices() {
	const { i18n, t } = useTranslation("accountSetting")
	const { t: tInterface } = useTranslation("interface")
	const navigate = useNavigate()
	const { timezone } = useTimezone()

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

	// Group devices for display without changing the API order or logout behavior.
	const { currentDevices, otherDevices } = useMemo(() => {
		const deviceList = devices ?? []
		if (!currentDevice) return { currentDevices: [], otherDevices: deviceList }

		return {
			currentDevices: deviceList.filter((item) => item.device_id === currentDevice),
			otherDevices: deviceList.filter((item) => item.device_id !== currentDevice),
		}
	}, [currentDevice, devices])

	// Format device times with the account timezone and locale before passing them to the rows.
	const getDeviceTimeLabel = useMemoizedFn((device: User.UserDeviceInfo, isCurrent: boolean) =>
		formatDeviceTime({ device, timezone, isCurrent, t: tInterface }),
	)

	// Return to the previous page using the existing transition.
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
		<div className="flex h-full w-full flex-col bg-sidebar" data-testid="login-devices-page">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
						data-testid="login-devices-back-button"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">{t("loginDevices")}</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-3.5 pb-safe-bottom">
				{/* Keep the existing security advice visible above the device list. */}
				<div
					className="mb-4 flex gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm leading-5 text-primary"
					data-testid="login-devices-security-tip"
				>
					<Shield className="mt-0.5 size-4 shrink-0" />
					<div>{tInterface("setting.tip.loginDevicesTip")}</div>
				</div>

				{/* The spin wrapper supplies a definite height to the actual device viewport. */}
				<MagicSpin
					className="min-h-0 flex-1"
					innerClassName="h-full min-h-0"
					spinning={isLoading}
				>
					{devices?.length === 0 ? (
						<div
							className="flex h-full items-center justify-center"
							data-testid="login-devices-empty"
						>
							<MagicEmpty description={t("noData")} />
						</div>
					) : (
						<ScrollArea
							className="h-full min-h-0"
							viewportClassName="pb-4 [&>div]:!flex [&>div]:flex-col [&>div]:gap-4"
							data-testid="login-devices-list"
						>
							{currentDevices.length > 0 ? (
								<DeviceSection
									title={tInterface("setting.loginDevices.currentSection")}
									devices={currentDevices}
									currentDevice={currentDevice}
									getTimeLabel={getDeviceTimeLabel}
									onLogout={handlers.handleLogout}
									data-testid="login-devices-current-section"
								/>
							) : null}

							<DeviceSection
								title={
									otherDevices.length > 0
										? tInterface(
												"setting.loginDevices.othersSectionWithCount",
												{
													count: otherDevices.length,
												},
											)
										: tInterface("setting.loginDevices.othersSection")
								}
								devices={otherDevices}
								currentDevice={currentDevice}
								getTimeLabel={getDeviceTimeLabel}
								emptyText={tInterface("setting.loginDevices.noOtherDevices")}
								onLogout={handlers.handleLogout}
								data-testid="login-devices-other-section"
							/>
						</ScrollArea>
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

interface DeviceSectionProps {
	title: string
	devices: User.UserDeviceInfo[]
	currentDevice: string | null
	getTimeLabel: (device: User.UserDeviceInfo, isCurrent: boolean) => string
	emptyText?: string
	onLogout: (deviceId: string) => void
	"data-testid": string
}

/** Render a device group while the page owns data assembly and logout state. */
function DeviceSection(props: DeviceSectionProps) {
	const {
		title,
		devices,
		currentDevice,
		getTimeLabel,
		emptyText,
		onLogout,
		"data-testid": dataTestId,
	} = props

	return (
		<section className="flex shrink-0 flex-col gap-2" data-testid={dataTestId}>
			<div className="px-[14px] text-sm leading-5 text-muted-foreground">{title}</div>
			<div className="flex w-full flex-col overflow-hidden rounded-lg bg-popover">
				{devices.length > 0 ? (
					devices.map((item, index) => (
						<DeviceItem
							key={item.id}
							deviceId={item.id}
							name={item.device_name}
							variant="mobile"
							os={item.os}
							system={formatDeviceSystem(item)}
							timeLabel={getTimeLabel(item, currentDevice === item.device_id)}
							isCurrent={currentDevice === item.device_id}
							showDivider={index < devices.length - 1}
							onLogout={onLogout}
						/>
					))
				) : (
					<div
						className="px-[14px] py-4 text-center text-sm leading-5 text-muted-foreground"
						data-testid="login-devices-other-empty"
					>
						{emptyText}
					</div>
				)}
			</div>
		</section>
	)
}

interface FormatDeviceTimeParams {
	device: User.UserDeviceInfo
	timezone: string
	isCurrent: boolean
	t: TFunction
}

/** Join the operating system and version without adding space for missing values. */
function formatDeviceSystem(device: User.UserDeviceInfo) {
	return [device.os, device.os_version].filter(Boolean).join(" ")
}

/** Render activity times in the account timezone to avoid ambiguous login records. */
function formatDeviceTime({ device, timezone, isCurrent, t }: FormatDeviceTimeParams) {
	const formattedTime = dayjs(device.updated_at).isValid()
		? dayjs(device.updated_at).tz(timezone).format("YYYY-MM-DD HH:mm")
		: "--"
	const key = isCurrent ? "setting.loginDevices.loggedInAt" : "setting.loginDevices.lastActiveAt"

	return t(key, { time: formattedTime })
}

export default observer(LoginDevices)

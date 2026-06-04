import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount } from "ahooks"

import MagicSpin from "@/components/base/MagicSpin"
import { MagicEmpty } from "@/components/base"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import VerificationCodeInput from "@/components/business/VerificationCodeInput"
import { useDeviceLogout } from "@/pages/user/pages/my/components/LoginDevices/hooks/useDeviceLogout"
import { useUserDevices } from "@/models/user/hooks"
import { useTimezone } from "@/providers/TimezoneProvider/hooks"
import { VerificationCode } from "@/constants/bussiness"
import dayjs from "@/lib/dayjs"
import { getDeviceInfo } from "@/utils/devices"
import type { User } from "@/types/user"
import type { TFunction } from "i18next"

import { MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME } from "../constants"
import { LoginDeviceRowView } from "./LoginDeviceRowView"
import { MobileSettingsSheetContainer } from "./SheetContainer"

interface MobileSettingsLoginDevicesSheetProps {
	open: boolean
	onClose: () => void
}

interface LoginDeviceSectionProps {
	title: string
	devices: User.UserDeviceInfo[]
	currentDeviceId: string | null
	getTimeLabel: (device: User.UserDeviceInfo, isCurrent: boolean) => string
	emptyText?: string
	onLogout: (deviceId: string) => void
	dataTestId: string
}

/** 设置内登录设备浮窗只承载现有真实能力：设备列表、本机分组、单台设备退出。 */
export function MobileSettingsLoginDevicesSheet({
	open,
	onClose,
}: MobileSettingsLoginDevicesSheetProps) {
	const { i18n, t } = useTranslation("interface")
	const { timezone } = useTimezone()
	const { data: devices, isLoading, mutate } = useUserDevices()
	const { state, handlers } = useDeviceLogout(devices || [], mutate)
	const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)

	useMount(() => {
		getDeviceInfo(i18n).then((response) => {
			setCurrentDeviceId(response.id)
		})
	})

	// 设备分组只消费现有列表字段，不臆造在线筛选或服务端计数能力。
	const { currentDevices, otherDevices } = useMemo(() => {
		const deviceList = devices ?? []
		if (!currentDeviceId) return { currentDevices: [], otherDevices: deviceList }

		return {
			currentDevices: deviceList.filter((item) => item.device_id === currentDeviceId),
			otherDevices: deviceList.filter((item) => item.device_id !== currentDeviceId),
		}
	}, [currentDeviceId, devices])

	// 时间展示遵循用户偏好时区，避免直接渲染后端原始时间。
	const getDeviceTimeLabel = useMemoizedFn((device: User.UserDeviceInfo, isCurrent: boolean) =>
		formatDeviceTime({ device, timezone, isCurrent, t }),
	)

	const pendingLogoutDevice = useMemo(
		() =>
			devices?.find(
				(item) =>
					item.id === state.currentDeviceId || item.device_id === state.currentDeviceId,
			) ?? null,
		[devices, state.currentDeviceId],
	)

	return (
		<>
			<MobileSettingsSheetContainer
				open={open}
				title={t("setting.loginDevices.label")}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) onClose()
				}}
				sheetClassName={MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME}
				contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
				scrollEdgeFade={{
					fadeColor: "muted",
					contentDeps: [
						devices?.length,
						isLoading,
						currentDevices.length,
						otherDevices.length,
					],
				}}
				dataTestId="mobile-settings-login-devices-sheet"
			>
				<MagicSpin className="min-h-[240px]" spinning={isLoading}>
					{devices?.length === 0 ? (
						<div
							className="flex min-h-[240px] items-center justify-center"
							data-testid="mobile-settings-login-devices-empty"
						>
							<MagicEmpty description={t("noData")} />
						</div>
					) : (
						<div
							className="flex flex-col gap-3 pb-3"
							data-testid="mobile-settings-login-devices-list"
						>
							{currentDevices.length > 0 ? (
								<LoginDeviceSection
									title={t("setting.loginDevices.currentSection")}
									devices={currentDevices}
									currentDeviceId={currentDeviceId}
									getTimeLabel={getDeviceTimeLabel}
									onLogout={handlers.handleLogout}
									dataTestId="mobile-settings-login-devices-current-section"
								/>
							) : null}

							<LoginDeviceSection
								title={
									otherDevices.length > 0
										? t("setting.loginDevices.othersSectionWithCount", {
												count: otherDevices.length,
											})
										: t("setting.loginDevices.othersSection")
								}
								devices={otherDevices}
								currentDeviceId={currentDeviceId}
								getTimeLabel={getDeviceTimeLabel}
								emptyText={t("setting.loginDevices.noOtherDevices")}
								onLogout={handlers.handleLogout}
								dataTestId="mobile-settings-login-devices-other-section"
							/>

							{/* TODO(mobile-refactor-cleanup): LOGIN-DEVICES-01 补齐登录日志、批量退出与异常上报 API 后，再恢复这些原型入口。 */}
							<p className="px-3.5 text-center text-xs leading-4 text-muted-foreground">
								{t("setting.loginDevices.footer")}
							</p>
						</div>
					)}
				</MagicSpin>
			</MobileSettingsSheetContainer>

			<MobileSettingsDeviceLogoutConfirmSheet
				open={state.isModalOpen}
				onCancel={handlers.handleCancel}
				onTrigger={handlers.handleTrigger}
				onInputComplete={handlers.handleInputComplete}
				isLoading={state.isLoading}
				deviceName={pendingLogoutDevice?.device_name}
			/>
		</>
	)
}

/** 单个设备分组复用登录设备行，保持分组标题、圆角卡片和空态结构一致。 */
function LoginDeviceSection({
	title,
	devices,
	currentDeviceId,
	getTimeLabel,
	emptyText,
	onLogout,
	dataTestId,
}: LoginDeviceSectionProps) {
	return (
		<section className="flex flex-col gap-2" data-testid={dataTestId}>
			<div className="px-3.5 text-sm leading-5 text-muted-foreground">{title}</div>
			<div className="flex w-full flex-col overflow-hidden rounded-lg bg-popover">
				{devices.length > 0 ? (
					devices.map((item, index) => {
						const isCurrent = currentDeviceId === item.device_id

						return (
							<LoginDeviceRowView
								key={item.id}
								device={item}
								system={formatDeviceSystem(item)}
								timeLabel={getTimeLabel(item, isCurrent)}
								isCurrent={isCurrent}
								showDivider={index < devices.length - 1}
								onLogout={onLogout}
							/>
						)
					})
				) : (
					<div
						className="px-3.5 py-4 text-center text-sm leading-5 text-muted-foreground"
						data-testid={`${dataTestId}-empty`}
					>
						{emptyText}
					</div>
				)}
			</div>
		</section>
	)
}

interface MobileSettingsDeviceLogoutConfirmSheetProps {
	open: boolean
	onCancel: () => void
	onTrigger: (codeType: VerificationCode) => Promise<void>
	onInputComplete: (code: string) => void
	isLoading: boolean
	deviceName?: string
}

/** 设备退出确认使用设置浮层体系，确保层级高于登录设备列表并保持统一视觉。 */
function MobileSettingsDeviceLogoutConfirmSheet({
	open,
	onCancel,
	onTrigger,
	onInputComplete,
	isLoading,
	deviceName,
}: MobileSettingsDeviceLogoutConfirmSheetProps) {
	const { t } = useTranslation("interface")
	const [code, setCode] = useState("")

	// 关闭确认层时同步清空本地验证码，避免下一次打开残留上次输入。
	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			setCode("")
			onCancel()
		}
	}

	// 输入满位后仍复用旧业务 hook 提交流程，新的 Sheet 只负责视觉和交互承载。
	function handleInputComplete(value: string) {
		setCode(value)
		onInputComplete(value)
	}

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.loginDevices.logoutConfirmTitle")}
			onOpenChange={handleOpenChange}
			contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-login-device-logout-confirm-sheet"
		>
			<p className="px-3.5 text-[15px] leading-5 text-muted-foreground">
				{deviceName
					? t("setting.loginDevices.logoutConfirmDeviceContent", { device: deviceName })
					: t("setting.loginDevices.logoutConfirmContent")}
			</p>
			<VerificationCodeButton
				className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
				codeType={VerificationCode.DeviceLogout}
				autoFetch
				trigger={(codeType) => onTrigger(codeType)}
				disabled={isLoading}
				data-testid="mobile-settings-login-device-send-code-button"
			/>
			<div className="flex flex-col gap-2">
				<div className="px-3.5 text-sm leading-5 text-muted-foreground">
					{t("setting.VerificationCode")}
				</div>
				<VerificationCodeInput
					value={code}
					onChange={setCode}
					onInputComplete={handleInputComplete}
					disabled={isLoading}
					autoFocus={false}
					containerClassName="w-full justify-between gap-2"
					slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
				/>
			</div>
		</MobileSettingsSheetContainer>
	)
}

interface FormatDeviceTimeParams {
	device: User.UserDeviceInfo
	timezone: string
	isCurrent: boolean
	t: TFunction
}

/** 设备系统信息按后端已有字段拼接，不补充原型中的 appVersion 等缺失字段。 */
function formatDeviceSystem(device: User.UserDeviceInfo) {
	return [device.os, device.os_version].filter(Boolean).join(" ")
}

/** 设备时间按账号时区渲染；当前接口没有 lastActiveAt，只能使用 updated_at 降级。 */
function formatDeviceTime({ device, timezone, isCurrent, t }: FormatDeviceTimeParams) {
	const formattedTime = dayjs(device.updated_at).isValid()
		? dayjs(device.updated_at).tz(timezone).format("YYYY-MM-DD HH:mm")
		: "--"
	const key = isCurrent ? "setting.loginDevices.loggedInAt" : "setting.loginDevices.lastActiveAt"

	return t(key, { time: formattedTime })
}

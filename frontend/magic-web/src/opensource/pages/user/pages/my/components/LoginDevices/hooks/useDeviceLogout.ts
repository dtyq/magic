import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { useTranslation } from "react-i18next"
import { UserApi } from "@/opensource/apis"
import { VerificationCode } from "@/opensource/constants/bussiness"
import type { DeviceLogoutState, DeviceLogoutHandlers } from "../types"

/**
 * useDeviceLogout - Device logout logic hook
 *
 * @param devices - Current devices list
 * @param mutate - Function to update devices list
 * @returns Device logout state and handlers
 */
export function useDeviceLogout(devices: any[], mutate: (data: any) => void) {
	const { t } = useTranslation("interface")

	// State management
	const [state, setState] = useState<DeviceLogoutState>({
		isModalOpen: false,
		currentDeviceId: null,
		isLoading: false,
	})

	// Handle logout initiation
	const handleLogout = useMemoizedFn(async (deviceId: string) => {
		setState((prev) => ({
			...prev,
			currentDeviceId: deviceId,
			isModalOpen: true,
		}))
	})

	// Handle verification code trigger
	const handleTrigger = useMemoizedFn(async (codeType: VerificationCode) => {
		try {
			setState((prev) => ({ ...prev, isLoading: true }))
			await UserApi.getUsersVerificationCode(codeType)
		} catch (error) {
			console.error(error)
			magicToast.error(t("setting.loginDevices.getCodeFailed"))
			handleCancel()
		} finally {
			setState((prev) => ({ ...prev, isLoading: false }))
		}
	})

	// Handle verification code input completion
	const handleInputComplete = useMemoizedFn((code: string) => {
		if (!state.currentDeviceId) return

		setState((prev) => ({ ...prev, isLoading: true }))

		UserApi.logoutDevices(code, state.currentDeviceId)
			.then(() => {
				magicToast.success(t("setting.loginDevices.logoutSuccess"))
				// Update devices list by filtering out the logged out device
				const updatedDevices = devices?.filter(
					(item) => item.device_id !== state.currentDeviceId,
				)
				mutate(updatedDevices)
			})
			.catch((error) => {
				console.error(error)
				magicToast.error(t("setting.loginDevices.getCodeFailed"))
			})
			.finally(() => {
				handleCancel()
			})
	})

	// Handle modal cancel
	const handleCancel = useMemoizedFn(() => {
		setState({
			isModalOpen: false,
			currentDeviceId: null,
			isLoading: false,
		})
	})

	const handlers: DeviceLogoutHandlers = {
		handleLogout,
		handleCancel,
		handleTrigger,
		handleInputComplete,
	}

	return {
		state,
		handlers,
	}
}

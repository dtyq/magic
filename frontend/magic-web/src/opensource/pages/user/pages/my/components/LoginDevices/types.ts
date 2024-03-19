import type { ReactNode } from "react"

// Device logout related interfaces
export interface DeviceLogoutState {
	isModalOpen: boolean
	currentDeviceId: string | null
	isLoading: boolean
}

export interface DeviceLogoutHandlers {
	handleLogout: (deviceId: string) => void
	handleCancel: () => void
	handleTrigger: (codeType: any) => Promise<void>
	handleInputComplete: (code: string) => void
}

// Component props interfaces
export interface LoginDevicesProps {
	className?: string
	children?: ReactNode
}

export interface LogoutConfirmModalProps {
	open: boolean
	onCancel: () => void
	onTrigger: (codeType: any) => Promise<void>
	onInputComplete: (code: string) => void
}

// Device item interface (if needed for future extensions)
export interface DeviceItemData {
	id: string
	device_id: string
	device_name: string
	os?: string
	os_version?: string
	updated_at: string
}

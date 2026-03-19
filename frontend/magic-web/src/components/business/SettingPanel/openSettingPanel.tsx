import { createRoot } from "react-dom/client"
import { createRef, lazy, Suspense } from "react"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { userStore } from "@/models/user"
import { reaction } from "mobx"
import { SettingPanelModalProps, SettingPanelModalRef } from "./types"

const SettingPanelModal = lazy(() =>
	import("./SettingPanelModal").then((module) => ({ default: module.SettingPanelModal })),
)

export interface OpenSettingPanelOptions extends SettingPanelModalProps {
	// Additional options can be added here
}

/**
 * Open SettingPanel imperatively
 *
 * @example
 * ```tsx
 * import { openSettingPanel } from "@/components/business/SettingPanel"
 * import { getAccountSettingMenuItems } from "@/components/business/AccountSetting"
 * import { useTranslation } from "react-i18next"
 *
 * function MyComponent() {
 *   const { t } = useTranslation("accountSetting")
 *
 *   const handleOpenSettings = () => {
 *     const menuItems = getAccountSettingMenuItems(t)
 *
 *     openSettingPanel({
 *       menuItems,
 *       renderContent: (key) => {
 *         const item = menuItems.find(m => m.key === key)
 *         return item?.component
 *       },
 *       defaultActiveKey: "myAccount", // Optional: jump to specific page
 *     })
 *   }
 *
 *   return <button onClick={handleOpenSettings}>Open Settings</button>
 * }
 * ```
 *
 * @param options - Setting panel configuration options
 * @returns An object with close and setActiveKey methods
 */
export function openSettingPanel(options: OpenSettingPanelOptions) {
	const div = document.createElement("div")
	document.body.appendChild(div)

	const root = createRoot(div)
	const modalRef = createRef<SettingPanelModalRef>()

	// Auto close when user or organization changes
	const disposer = reaction(
		() => [userStore.user.organizationCode, userStore.user.userInfo?.magic_id],
		(prev, next) => {
			if (prev[0] !== next[0] || prev[1] !== next[1]) {
				onClose()
			}
		},
	)

	function onClose() {
		// Use setTimeout to ensure uninstallation in the next event loop
		setTimeout(() => {
			try {
				disposer()
				root.unmount()
			} catch (error) {
				console.warn("Error during root unmount:", error)
			}

			// Ensure DOM element is safely removed
			if (div.parentNode) {
				div.parentNode.removeChild(div)
			}
		}, 0)
	}

	root.render(
		<AppearanceProvider>
			<Suspense fallback={null}>
				<SettingPanelModal
					{...options}
					ref={modalRef}
					onClose={() => {
						options?.onClose?.()
						onClose?.()
					}}
				/>
			</Suspense>
		</AppearanceProvider>,
	)

	return {
		close: () => modalRef.current?.close(),
		setActiveKey: (key: string) => modalRef.current?.setActiveKey(key),
	}
}

import { createContext, useContext } from "react"

export interface MobileSettingsContextValue {
	isSettingsOpen: boolean
	openSettings: () => void
	closeSettings: () => void
	setSettingsOpen: (open: boolean) => void
}

const MobileSettingsContext = createContext<MobileSettingsContextValue | null>(null)

/** Provides shared open/close state for the mobile settings sheet inside SuperMobileShell. */
export function MobileSettingsProvider(props: {
	value: MobileSettingsContextValue
	children: React.ReactNode
}) {
	const { value, children } = props
	return <MobileSettingsContext.Provider value={value}>{children}</MobileSettingsContext.Provider>
}

/** Sidebar and settings panel read the same controller from SuperMobileShellRouteLayout. */
export function useMobileSettingsController() {
	const context = useContext(MobileSettingsContext)
	if (!context) {
		throw new Error("useMobileSettingsController must be used within MobileSettingsProvider")
	}
	return context
}

import { createContext, useContext } from "react"

export interface MobileSettingsContextValue {
	isSettingsOpen: boolean
	openSettings: () => void
	closeSettings: () => void
	setSettingsOpen: (open: boolean) => void
}

const MobileSettingsContext = createContext<MobileSettingsContextValue | null>(null)

/** 统一提供 V2 壳层下的设置浮层开关，避免为局部 UI 再引入全局 store。 */
export function MobileSettingsProvider(props: {
	value: MobileSettingsContextValue
	children: React.ReactNode
}) {
	const { value, children } = props
	return <MobileSettingsContext.Provider value={value}>{children}</MobileSettingsContext.Provider>
}

/** 侧栏与设置浮层共享同一份局部状态，确保入口与弹层在 V2 下同层协作。 */
export function useMobileSettingsController() {
	const context = useContext(MobileSettingsContext)
	if (!context) {
		throw new Error("useMobileSettingsController must be used within MobileSettingsProvider")
	}
	return context
}

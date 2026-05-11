import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

/** DOM host for the multi-platform switcher, rendered via createPortal. */
const SelfMediaPlatformChromeContext = createContext<{
	hostElement: HTMLDivElement | null
	setHostElement: (el: HTMLDivElement | null) => void
} | null>(null)

export function SelfMediaPlatformChromeProvider({ children }: { children: ReactNode }) {
	const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null)
	const value = useMemo(() => ({ hostElement, setHostElement }), [hostElement])
	return (
		<SelfMediaPlatformChromeContext.Provider value={value}>
			{children}
		</SelfMediaPlatformChromeContext.Provider>
	)
}

export function useSelfMediaPlatformChrome() {
	const ctx = useContext(SelfMediaPlatformChromeContext)
	if (!ctx) {
		throw new Error(
			"useSelfMediaPlatformChrome must be used within SelfMediaPlatformChromeProvider",
		)
	}
	return ctx
}

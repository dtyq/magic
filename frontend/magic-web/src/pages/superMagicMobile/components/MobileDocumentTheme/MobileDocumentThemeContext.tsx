import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export interface MobileDocumentThemeContextValue {
	isSidebarOpen: boolean
	setSidebarOpen: (open: boolean) => void
}

const MobileDocumentThemeContext = createContext<MobileDocumentThemeContextValue | null>(null)

interface MobileDocumentThemeProviderProps {
	children: ReactNode
}

/**
 * Holds mobile shell sidebar state so global theme-color sync can switch muted vs default.
 */
export function MobileDocumentThemeProvider({ children }: MobileDocumentThemeProviderProps) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)

	const setSidebarOpen = useCallback((open: boolean) => {
		setIsSidebarOpen(open)
	}, [])

	const value = useMemo<MobileDocumentThemeContextValue>(
		() => ({
			isSidebarOpen,
			setSidebarOpen,
		}),
		[isSidebarOpen, setSidebarOpen],
	)

	return (
		<MobileDocumentThemeContext.Provider value={value}>
			{children}
		</MobileDocumentThemeContext.Provider>
	)
}

/**
 * Read sidebar flag for document theme sync (defaults closed when provider is absent).
 */
export function useMobileDocumentThemeState(): Pick<
	MobileDocumentThemeContextValue,
	"isSidebarOpen"
> {
	const ctx = useContext(MobileDocumentThemeContext)
	return { isSidebarOpen: ctx?.isSidebarOpen ?? false }
}

/**
 * Shell layouts call this to report drawer open/close without touching meta directly.
 */
export function useMobileDocumentThemeControl(): Pick<
	MobileDocumentThemeContextValue,
	"setSidebarOpen"
> {
	const ctx = useContext(MobileDocumentThemeContext)
	if (!ctx) {
		throw new Error(
			"useMobileDocumentThemeControl must be used under MobileDocumentThemeProvider",
		)
	}
	return { setSidebarOpen: ctx.setSidebarOpen }
}

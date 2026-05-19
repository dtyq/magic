import { createContext, useContext, type ReactNode } from "react"

const HostUiLocaleContext = createContext<string | undefined>(undefined)

interface HostUiLocaleProviderProps {
	/** 宿主界面语言码（如 react-i18next 的 resolvedLanguage），未传时子树内为 undefined */
	locale?: string
	children: ReactNode
}

export function HostUiLocaleProvider({ locale, children }: HostUiLocaleProviderProps) {
	return <HostUiLocaleContext.Provider value={locale}>{children}</HostUiLocaleContext.Provider>
}

/** 画布内依赖宿主语言的 UI（如视频编辑器外壳宽度）使用 */
export function useHostUiLocale(): string | undefined {
	return useContext(HostUiLocaleContext)
}

import { StyleProvider, legacyLogicalPropertiesTransformer } from "@ant-design/cssinjs"
import type { PropsWithChildren } from "react"
import { getBrowserInfo } from "./browser"

interface BrowserProviderProps extends PropsWithChildren {}

const { isOutdated } = getBrowserInfo()

/**
 * Provides CSS style elevation fallback for outdated browsers.
 * The warning modal has been moved to an early HTML pre-check script to prevent white-screen crashes.
 *
 * @param {BrowserProviderProps} props - Component props containing children
 * @returns {React.ReactNode} Children wrapped with StyleProvider if outdated
 */
export function BrowserProvider(props: BrowserProviderProps) {
	if (!isOutdated) {
		return props?.children
	}

	return (
		<StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
			{props?.children}
		</StyleProvider>
	)
}

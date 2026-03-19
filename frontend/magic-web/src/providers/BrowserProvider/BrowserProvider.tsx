import { StyleProvider, legacyLogicalPropertiesTransformer } from "@ant-design/cssinjs"
import { lazy } from "react"
import type { PropsWithChildren } from "react"
import { getBrowserInfo } from "./browser"

const BrowserWarning = lazy(() => import("./BrowserWarning"))

interface BrowserProviderProps extends PropsWithChildren {}

const { isOutdated } = getBrowserInfo()

let ready = true
/**
 * @description 浏览器版本过低兼容性处理(为了避免影响原始版本样式兼容问题，所以只针对低版本浏览器增加哈希提权)
 * @param {BrowserProviderProps} props
 * @constructor
 */
export function BrowserProvider(props: BrowserProviderProps) {
	if (!isOutdated) {
		return props?.children
	}

	return (
		<StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
			{props?.children}
			{ready && (
				<BrowserWarning
					onClose={() => {
						ready = false
					}}
				/>
			)}
		</StyleProvider>
	)
}

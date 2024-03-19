import { memo, useEffect } from "react"
import CommonHeaderV2 from "../CommonHeaderV2"
import type { CommonHeaderV2Props } from "../CommonHeaderV2/types"

/**
 * @deprecated Use CommonHeaderV2 directly.
 */
function DeprecatedCommonHeader(props: CommonHeaderV2Props) {
	useEffect(() => {
		if (import.meta.env.DEV) {
			console.warn("[Deprecated] CommonHeader is deprecated. Use CommonHeaderV2 directly.")
		}
	}, [])

	return <CommonHeaderV2 {...props} />
}

/**
 * @deprecated Use CommonHeaderV2Props directly.
 */
export type CommonHeaderProps = CommonHeaderV2Props

export default memo(DeprecatedCommonHeader)

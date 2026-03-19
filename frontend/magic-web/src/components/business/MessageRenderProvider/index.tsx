import type { PropsWithChildren } from "react"
import { memo, useMemo } from "react"
import { messageRenderContext } from "./context"

interface ContextProps extends PropsWithChildren {
	hiddenDetail: boolean
}

const MessageRenderProvider = memo(({ hiddenDetail = false, children }: ContextProps) => {
	const value = useMemo(
		() => ({
			hiddenDetail,
		}),
		[hiddenDetail],
	)

	return <messageRenderContext.Provider value={value}>{children}</messageRenderContext.Provider>
})

export default MessageRenderProvider

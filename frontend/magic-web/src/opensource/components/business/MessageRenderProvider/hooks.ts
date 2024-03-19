import { useContext } from "react"
import { messageRenderContext } from "./context"

export const useMessageRenderContext = () => {
	return useContext(messageRenderContext)
}

import type { FC } from "react"
import ProjectPageInputContainer from "../ProjectPageInputContainer"
import type { MessagePanelProps } from "./types"

/**
 * @deprecated Use ProjectPageInputContainer directly for new call sites.
 */
const MessagePanel: FC<MessagePanelProps> = (props) => {
	return <ProjectPageInputContainer {...props} />
}

export default MessagePanel

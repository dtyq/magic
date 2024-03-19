import { observer } from "mobx-react-lite"
import { Suspense, lazy } from "react"
import { MessageReceiveType } from "@/opensource/types/chat"
import type { ConversationHeaderProps } from "./types"
import HeaderFallback from "./HeaderFallback"

// Lazy load header components
const AiHeader = lazy(() => import("./AiHeader"))
const UserHeader = lazy(() => import("./UserHeader"))
const GroupHeader = lazy(() => import("./GroupHeader"))

const ConversationHeader = observer(
	({
		receiveId,
		receiveType,
		headerTitleClass,
		headerSubTitleClass,
		className,
	}: ConversationHeaderProps) => {
		if (!receiveId || receiveType === undefined) return null

		const headerProps = {
			receiveId,
			headerTitleClass,
			headerSubTitleClass,
			className,
		}

		const fallbackProps = {
			headerTitleClass,
			headerSubTitleClass,
			className,
		}

		return (
			<Suspense fallback={<HeaderFallback {...fallbackProps} />}>
				{receiveType === MessageReceiveType.Ai && <AiHeader {...headerProps} />}
				{receiveType === MessageReceiveType.User && <UserHeader {...headerProps} />}
				{receiveType === MessageReceiveType.Group && <GroupHeader {...headerProps} />}
			</Suspense>
		)
	},
)

export default ConversationHeader

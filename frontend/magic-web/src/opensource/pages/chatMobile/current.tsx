import CurrentConversation from "./components/CurrentConversation"

import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import FullSpin from "@/opensource/components/other/FullSpin"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { useLocation } from "react-router"
import { Navigate } from "@/opensource/routes/components/Navigate"
import { RouteName } from "@/opensource/routes/constants"
import { getRoutePath } from "@/opensource/routes/history/helpers"

const ConversationById = observer(() => {
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	const location = useLocation()

	const conversationId = ConversationStore.currentConversation?.id

	if (!isMobile) {
		return <Navigate name={RouteName.Chat} replace />
	}

	if (!conversationId) {
		return <FullSpin />
	}

	return (
		<CurrentConversation
			visible={location.pathname === getRoutePath({ name: RouteName.ChatConversation })}
			onBack={() => {
				navigate({
					delta: -1,
					viewTransition: {
						type: "slide",
						direction: "right",
						duration: 300,
					},
				})
			}}
		/>
	)
})

export default ConversationById

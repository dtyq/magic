import { observer } from "mobx-react-lite"
import { matchPath, useLocation } from "react-router"
import { RoutePath } from "@/constants/routes"
import { userStore } from "@/models/user"
import Container from "../../components/MainInputContainer"
import NewUserBenefits from "../../components/NewUserBenefits"
import Header from "./components/Header"
import { useFeaturedModeListRefreshOnAgentsPageMount } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import ChatConversationSwitcher from "../ChatHomePage/components/ChatConversationSwitcher"
import ChatHomeEditor from "../ChatHomePage/components/ChatHomeEditor"

function AgentsPage() {
	useFeaturedModeListRefreshOnAgentsPageMount()
	const location = useLocation()
	const isChatHome = Boolean(
		matchPath(`/:clusterCode${RoutePath.SuperChatHome}`, location.pathname),
	)
	const identity = `${userStore.user.userInfo?.user_id}:${userStore.user.organizationCode}`

	return (
		<div className="relative flex flex-1 flex-col items-center overflow-hidden rounded-xl border border-border bg-background">
			{isChatHome ? (
				<div className="flex h-12 w-full shrink-0 items-center px-3">
					<ChatConversationSwitcher />
				</div>
			) : (
				<Header className="shrink-0" />
			)}
			{/* Both routes use this same shell; only session-bound editor state is recreated. */}
			<Container
				EditorComponent={isChatHome ? ChatHomeEditor : undefined}
				editorSessionKey={`${identity}:${isChatHome ? location.key : "task"}`}
				showRoleSwitcher={!isChatHome}
				homeVariant={isChatHome ? "chat" : "task"}
			/>
			<NewUserBenefits />
		</div>
	)
}

export default observer(AgentsPage)

// React 相关
import { observer } from "mobx-react-lite"
import { lazy, Suspense, useEffect, useState } from "react"

// Store 和服务
import { userStore } from "@/opensource/models/user"
import { appService } from "@/opensource/services/app/AppService"
import { INIT_DOMAINS } from "@/opensource/models/user/stores/initialization.store"

// Hooks 和工具
import useNavigateConversationByAgentIdInSearchQuery from "./hooks/useNavigateConversationByAgentIdInSearchQuery"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import ChatDesktopSkeleton from "./lazy/skeleton/ChatDesktopSkeleton"
import ChatMobileSkeleton from "./lazy/skeleton/ChatMobileSkeleton"

const ChatMobile = lazy(() => import("../chatMobile/index"))
const ChatDesktop = lazy(() => import("./index.desktop"))

const ChatNewWrapper = observer(() => {
	const isMobile = useIsMobile()
	useNavigateConversationByAgentIdInSearchQuery()

	const magicUser = userStore.user.userInfo
	const [isChatInitializing, setIsChatInitializing] = useState(() => {
		if (!magicUser) return false
		return !userStore.initialization.isInitialized({
			magicId: magicUser.magic_id,
			organizationCode: magicUser.organization_code,
			domain: INIT_DOMAINS.chat,
		})
	})

	useEffect(() => {
		if (!magicUser) {
			setIsChatInitializing(false)
			return
		}

		const alreadyInitialized = userStore.initialization.isInitialized({
			magicId: magicUser.magic_id,
			organizationCode: magicUser.organization_code,
			domain: INIT_DOMAINS.chat,
		})
		if (alreadyInitialized) {
			setIsChatInitializing(false)
			return
		}

		let active = true
		setIsChatInitializing(true)
		appService
			.initChatDataIfNeeded(magicUser)
			.catch((error) => {
				console.error("initChatDataIfNeeded error", error)
			})
			.finally(() => {
				if (!active) return
				setIsChatInitializing(false)
			})

		return () => {
			active = false
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [magicUser?.magic_id, magicUser?.organization_code])

	if (isChatInitializing) return isMobile ? <ChatMobileSkeleton /> : <ChatDesktopSkeleton />

	if (isMobile) {
		return (
			<Suspense fallback={<ChatMobileSkeleton />}>
				<ChatMobile />
			</Suspense>
		)
	}

	return (
		<Suspense fallback={<ChatDesktopSkeleton />}>
			<ChatDesktop />
		</Suspense>
	)
})

export default ChatNewWrapper

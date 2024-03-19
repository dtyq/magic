import { lazy, Suspense, useEffect } from "react"
import { observer } from "mobx-react-lite"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import { MessageReceiveType } from "@/opensource/types/chat"
import { t } from "i18next"
import { useLocation } from "react-router"
import { Navigate } from "@/opensource/routes/components/Navigate"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import MagicNavBar from "@/opensource/components/base-mobile/MagicNavBar"
import { createStyles } from "antd-style"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { interfaceStore } from "@/opensource/stores/interface"
import { RouteName } from "@/opensource/routes/constants"
import { getRoutePath } from "@/opensource/routes/history/helpers"

const useStyles = createStyles(({ css, token }) => {
	return {
		navBar: css`
			background-color: ${token.magicColorScales.white};
		`,
		container: css`
			height: calc(100% - ${token.safeAreaInsetTop} - ${token.safeAreaInsetBottom} - 44px);
			padding: 10px 10px 0 10px;
			background-color: ${token.magicColorScales.grey[0]};
		`,
	}
})

const AISetting = lazy(
	() => import("@/opensource/pages/chatNew/components/setting/components/AiSetting"),
)
const UserSetting = lazy(
	() => import("@/opensource/pages/chatNew/components/setting/components/UserSetting"),
)
const GroupSetting = lazy(
	() => import("@/opensource/pages/chatNew/components/setting/components/GroupSetting"),
)

const ComponentMap = {
	[MessageReceiveType.Ai]: AISetting,
	[MessageReceiveType.User]: UserSetting,
	[MessageReceiveType.Group]: GroupSetting,
}

const SettingContent = observer(() => {
	const navigate = useNavigate()
	const { styles } = useStyles()
	const isMobile = useIsMobile()
	const location = useLocation()
	const { currentConversation } = conversationStore

	useEffect(() => {
		let destroy = null
		if (location.pathname === getRoutePath({ name: RouteName.ChatSetting }))
			destroy = interfaceStore.setEnableGlobalSafeArea({
				// top: false,
				// bottom: false,
			})

		return () => {
			if (destroy) {
				destroy()
			}
		}
	}, [location.pathname])

	if (!isMobile) {
		return <Navigate name={RouteName.Chat} replace />
	}

	if (!currentConversation) return <Navigate name={RouteName.ChatConversation} replace />

	const receiveType = currentConversation?.receive_type

	const Component = ComponentMap[receiveType as keyof typeof ComponentMap]

	if (!Component) return <Navigate name={RouteName.ChatConversation} replace />

	return (
		<>
			<MagicNavBar
				className={styles.navBar}
				onBack={() =>
					navigate({
						delta: -1,
						viewTransition: {
							type: "slide",
							direction: "right",
						},
					})
				}
			>
				<span style={{ fontSize: 16, fontWeight: 600 }}>{t("chat.setting")}</span>
			</MagicNavBar>
			<div className={styles.container}>
				<Suspense fallback={null}>
					<Component />
				</Suspense>
			</div>
		</>
	)
})

export default SettingContent

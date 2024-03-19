import { observer } from "mobx-react-lite"
import { NavBar } from "antd-mobile"
import MemberCard from "@/opensource/components/business/MemberCard"
import { useMemoizedFn } from "ahooks"
import { useUserDetailStyles } from "./styles"
import { useMemberCardConfig } from "./config"
import MemberCardButtons from "@/opensource/components/business/MemberCard/MemberCardButtons"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import ConversationService from "@/opensource/services/chat/conversation/ConversationService"
import { MessageReceiveType } from "@/opensource/types/chat"
import { UserType } from "@/opensource/types/user"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import { useParams } from "react-router"
import { Navigate } from "@/opensource/routes/components/Navigate"
import userInfoStore from "@/opensource/stores/userInfo"
import { useEffect } from "react"
import MemberCardStore from "@/opensource/stores/display/MemberCardStore"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MagicSafeArea from "@/opensource/components/base/MagicSafeArea"
import { interfaceStore } from "@/opensource/stores/interface"
import { RouteName } from "@/opensource/routes/constants"

const UserInfoDetail = observer(() => {
	const { userId } = useParams()
	const navigate = useNavigate()
	const { styles } = useUserDetailStyles()
	const memberCardConfig = useMemberCardConfig()
	const isMobile = useIsMobile()

	useEffect(() => {
		if (userId) {
			MemberCardStore.openCard(userId, { x: 0, y: 0 })
		}

		return () => {
			MemberCardStore.closeCard(true)
		}
	}, [userId])

	useEffect(() => {
		return interfaceStore.setEnableGlobalSafeArea({
			// top: false,
			// bottom: false,
		})
	}, [])

	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: { type: "slide", direction: "right" },
		})
	})

	const onChatWith = useMemoizedFn(async () => {
		if (!userId) return

		const userInfo = userInfoStore.get(userId)

		if (!userInfo) return

		const conversation = await ConversationService.createConversation(
			userInfo.user_type === UserType.AI ? MessageReceiveType.Ai : MessageReceiveType.User,
			userInfo.user_id,
		)
		if (conversation) {
			ConversationService.switchConversation(conversation)
		}

		navigate({
			name: RouteName.ChatConversation,
			viewTransition: { type: "slide", direction: "left" },
		})
	})

	if (!isMobile) {
		return <Navigate name={RouteName.Chat} replace />
	}

	return (
		<>
			<div style={{ height: "100%" }} className={styles.container}>
				<NavBar className={styles.navBar} onBack={handleBack}></NavBar>
				<div className={styles.mask}></div>
				{!userId ? (
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<MagicEmpty description="未选择用户" />
					</div>
				) : (
					<>
						<MemberCard {...memberCardConfig} />
						<MemberCardButtons
							onChatWith={onChatWith}
							className={styles.buttons}
							vertical={false}
						/>
					</>
				)}
			</div>
			<MagicSafeArea position="bottom" style={{ background: "#ffffff" }} />
		</>
	)
})

export default UserInfoDetail

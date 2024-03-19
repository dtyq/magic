import { observer } from "mobx-react-lite"
import FlexBox from "@/opensource/components/base/FlexBox"
import ChatMessageList from "@/opensource/pages/chatNew/components/ChatMessageList"
import MessageEditor from "./components/MessageEditor"
import ConversationHeader from "./components/ConversationHeader"
import { useCurrentConversationStyles } from "./styles"

// Stores
import conversationStore from "@/opensource/stores/chatNew/conversation"
import SettingButton from "./components/ConversationHeader/components/setting/Button"

import { useMemoizedFn } from "ahooks"
import ImagePreview from "../ImagePreview"
import FilePreviewPopup from "./components/FilePreviewPopup"
import MagicNavBar from "@/opensource/components/base-mobile/MagicNavBar"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useEffect, useRef } from "react"
import MagicSafeArea from "@/opensource/components/base/MagicSafeArea"
import { interfaceStore } from "@/opensource/stores/interface"
import { RouteName } from "@/opensource/routes/constants"

interface CurrentConversationProps {
	visible: boolean
	onBack: () => void
}

const CurrentConversation = observer(({ visible, onBack }: CurrentConversationProps) => {
	const { currentConversation } = conversationStore
	const navigate = useNavigate()
	const { styles, cx } = useCurrentConversationStyles()

	const containerRef = useRef<HTMLDivElement>(null)
	const chatMessageListRef = useRef<{
		scrollToBottom: (force?: boolean) => void
	}>(null)

	const openSetting = useMemoizedFn(() => {
		navigate({
			name: RouteName.ChatSetting,
			viewTransition: {
				type: "slide",
				direction: "left",
			},
		})
	})

	useEffect(() => {
		if (visible) {
			chatMessageListRef.current?.scrollToBottom(true)
		}
	}, [visible])

	const handleBack = useMemoizedFn(() => {
		onBack()
	})

	useEffect(() => {
		let destroy = null
		if (visible) {
			destroy = interfaceStore.setEnableGlobalSafeArea({
				// top: false,
				// bottom: false,
			})
		}

		return () => {
			if (destroy) {
				destroy()
			}
		}
	}, [visible])

	if (!currentConversation) return null

	return (
		<FlexBox vertical className={cx(styles.container)} ref={containerRef}>
			<MagicSafeArea position="top" className={styles.safeArea} />
			<MagicNavBar onBack={handleBack} right={<SettingButton onClick={openSetting} />}>
				<ConversationHeader
					receiveId={currentConversation.receive_id}
					receiveType={currentConversation.receive_type}
					headerTitleClass={styles.headerTitle}
					headerSubTitleClass={styles.headerSubTitle}
				/>
			</MagicNavBar>
			<ChatMessageList ref={chatMessageListRef} />
			<MessageEditor />
			<ImagePreview />
			<FilePreviewPopup />
		</FlexBox>
	)
})

export default CurrentConversation

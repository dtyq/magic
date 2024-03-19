import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import ChatMenu from "../../../ChatMenu"
import chatMenuStore from "@/opensource/stores/chatNew/chatMenu"

const SharedChatMenu = observer(() => {
	const triggerRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
	const currentConversationId = chatMenuStore.currentConversationId

	useEffect(() => {
		if (currentConversationId) {
			const element = document.getElementById(currentConversationId)
			if (element) {
				const rect = element.getBoundingClientRect()
				setPosition({
					left: rect.right,
					top: rect.top + rect.height / 2,
				})
			}
		} else {
			setPosition(null)
		}
	}, [currentConversationId])

	if (!currentConversationId || !position) {
		return null
	}

	return (
		<ChatMenu
			open={true}
			onOpenChange={(open) => {
				if (!open) {
					chatMenuStore.closeMenu()
				}
			}}
			conversationId={currentConversationId}
			trigger={chatMenuStore.triggerType}
			placement="rightTop"
		>
			<div
				ref={triggerRef}
				style={{
					position: "fixed",
					left: `${position.left}px`,
					top: `${position.top}px`,
					width: "1px",
					height: "1px",
					pointerEvents: "none",
					zIndex: -1,
				}}
			/>
		</ChatMenu>
	)
})

export default SharedChatMenu

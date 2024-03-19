import useSendMessage from "@/opensource/pages/chatNew/hooks/useSendMessage"
import { ConversationMessageType } from "@/opensource/types/chat/conversation_message"
import { useMemoizedFn } from "ahooks"
import { memo, type AnchorHTMLAttributes } from "react"
import MagicButton from "@/opensource/components/base/MagicButton"
import { MagicFunctionLinkType } from "./const"

type MagicFunctionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
	href: string
}

const MagicFunctionLink = memo(({ href, children }: MagicFunctionLinkProps) => {
	const sendMessage = useSendMessage()

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault()
		e.stopPropagation()

		const url = new URL(href)
		switch (url.hostname) {
			case MagicFunctionLinkType.SendMessage:
				const searchParams = new URLSearchParams(url.search)
				const content = searchParams.get("content")

				if (!content) {
					return
				}

				sendMessage({
					type: ConversationMessageType.Text,
					text: {
						content,
					},
				})
				break
			default:
				break
		}
	})

	return (
		<MagicButton type="link" size="small" style={{ display: "inline" }} onClick={handleClick}>
			{children}
		</MagicButton>
	)
})

export default MagicFunctionLink

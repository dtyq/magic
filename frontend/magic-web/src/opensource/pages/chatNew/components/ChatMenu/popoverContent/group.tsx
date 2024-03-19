// import MagicButton from "@/opensource/components/base/MagicButton"
// import MagicIcon from "@/opensource/components/base/MagicIcon"
// import { IconMenuDeep } from "@tabler/icons-react"
// import { useTranslation } from "react-i18next"
import TopConversationButton from "../buttons/TopConversationButton"
import MuteConversationButton from "../buttons/MuteConversationButton"
import HideConversationButton from "../buttons/HideConversationButton"

export default function GroupPopoverContent({ conversationId }: { conversationId: string }) {
	// const { t } = useTranslation("interface")

	return (
		<>
			<TopConversationButton conversationId={conversationId} />
			<MuteConversationButton conversationId={conversationId} />
			{/* <MagicButton
				justify="flex-start"
				icon={<MagicIcon component=   {IconMenuDeep} size={20} />}
				size="large"
				type="text"
				block
			>
				{t("chat.floatButton.moveToGroup")}
			</MagicButton> */}
			<HideConversationButton conversationId={conversationId} />
		</>
	)
}

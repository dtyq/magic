import { ChevronsUpDown, MessageCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import ChatsSubMenu from "@/layouts/BaseLayout/components/MagicSidebar/ChatsSubMenu"

/** Reuse the sidebar conversation data source while presenting it in the chat home header. */
export default function ChatConversationSwitcher() {
	const { t } = useTranslation(["sidebar", "super"])

	return (
		<ChatsSubMenu placement="bottomLeft">
			<button
				type="button"
				className="flex h-8 max-w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm leading-5 text-secondary-foreground shadow-xs"
				data-testid="chat-home-conversation-switcher"
			>
				<MessageCircle size={16} strokeWidth={1.5} />
				<span className="min-w-0 truncate">
					{t("super:chatList.title")} / {t("super:chatList.newConversation")}
				</span>
				<ChevronsUpDown size={16} strokeWidth={1.5} />
			</button>
		</ChatsSubMenu>
	)
}

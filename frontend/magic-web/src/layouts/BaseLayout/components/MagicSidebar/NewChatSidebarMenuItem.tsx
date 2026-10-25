import { MessageCirclePlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/shadcn-ui/sidebar"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"

interface NewChatSidebarMenuItemProps {
	collapsed: boolean
	isActive?: boolean
	onSelect?: () => void
}

/** Open the blank composer; the first send owns conversation creation. */
export default function NewChatSidebarMenuItem({
	collapsed,
	isActive = false,
	onSelect,
}: NewChatSidebarMenuItemProps) {
	const { t } = useTranslation("sidebar")
	const navigate = useNavigate()

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				type="button"
				tooltip={collapsed ? t("chats.newChat") : undefined}
				data-testid="sidebar-content-new-chat-button"
				className="text-sidebar-foreground"
				isActive={isActive}
				onClick={() => {
					navigate({ name: RouteName.SuperChatHome, viewTransition: false })
					onSelect?.()
				}}
			>
				<MessageCirclePlus className="h-4 w-4 shrink-0" />
				<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-5">
					{t("chats.newChat")}
				</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}

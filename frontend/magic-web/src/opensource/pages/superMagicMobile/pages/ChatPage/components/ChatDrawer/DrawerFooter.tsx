import { MessageCirclePlus, UsersRound, CirclePlus } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"

interface DrawerFooterProps {
	activeTab: "chats" | "workspaces"
	onNewChat?: () => void
	onSharedWorkspace?: () => void
	onNewWorkspace?: () => void
}

function DrawerFooter({
	activeTab,
	onNewChat,
	onSharedWorkspace,
	onNewWorkspace,
}: DrawerFooterProps) {
	const { t } = useTranslation("super")

	if (activeTab === "chats") {
		return (
			<Button className="h-9 w-full gap-2 rounded-lg shadow-xs" onClick={onNewChat}>
				<MessageCirclePlus size={16} />
				<span className="text-sm font-medium leading-5">{t("common.newChat")}</span>
			</Button>
		)
	}

	if (activeTab === "workspaces") {
		return (
			<div className="flex flex-col gap-2">
				<Button
					variant="outline"
					className="h-9 w-full gap-2 rounded-lg bg-white shadow-xs"
					onClick={onSharedWorkspace}
				>
					<UsersRound size={16} />
					<span className="text-sm font-medium leading-5">
						{t("workspace.sharedWorkspace")}
					</span>
				</Button>
				<Button className="h-9 w-full gap-2 rounded-lg shadow-xs" onClick={onNewWorkspace}>
					<CirclePlus size={16} />
					<span className="text-sm font-medium leading-5">
						{t("workspace.newWorkspace")}
					</span>
				</Button>
			</div>
		)
	}

	return null
}

export default DrawerFooter

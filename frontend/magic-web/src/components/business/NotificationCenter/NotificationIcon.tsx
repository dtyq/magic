import folderIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import magicAvatar from "@/assets/logos/magic-avatar.svg"
import projectIcon from "@/pages/superMagic/assets/svg/project_icon.svg"
import SkillIcon from "@/components/business/MentionPanel/components/icons/SkillIcon"
import BotIcon from "@/components/business/MentionPanel/components/icons/BotIcon"
import MicroAppIcon from "@/components/business/MentionPanel/components/icons/MicroAppIcon"
import PlugIcon from "@/components/business/MentionPanel/components/icons/PlugIcon"
import successIcon from "@/pages/superMagic/assets/svg/topic-status-success.svg"
import alertIcon from "@/pages/superMagic/assets/svg/interrupt.svg"
import { cn } from "@/utils/cn"
import type { NotificationIconName } from "./types"

// Reuse existing product artwork for notification categories.
const NOTIFICATION_IMAGES: Record<
	Exclude<NotificationIconName, "spark" | "robot" | "microApp" | "connector">,
	string
> = {
	file: folderIcon,
	users: projectIcon,
	share: magicAvatar,
	project: projectIcon,
	alert: alertIcon,
	points: magicAvatar,
	payment: magicAvatar,
	success: successIcon,
}

function NotificationIcon({
	name,
	mobile = false,
}: {
	name: NotificationIconName
	mobile?: boolean
}) {
	const size = mobile ? 40 : 32
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center",
				mobile ? "size-10" : "size-8",
			)}
			aria-hidden
		>
			{/* Reuse the default icons rendered by @ panel list items, rather than category artwork. */}
			{name === "spark" ? (
				<SkillIcon size={size} />
			) : name === "robot" ? (
				<BotIcon size={size} />
			) : name === "microApp" ? (
				<MicroAppIcon size={size} />
			) : name === "connector" ? (
				<PlugIcon size={size} />
			) : (
				<img
					src={NOTIFICATION_IMAGES[name]}
					alt=""
					width={size}
					height={size}
					className={cn("object-contain", mobile ? "size-10" : "size-8")}
				/>
			)}
		</div>
	)
}

export default NotificationIcon

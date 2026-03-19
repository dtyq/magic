import { Button } from "@/components/shadcn-ui/button"
import { useUserInfo } from "@/models/user/hooks"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"

interface WorkspaceButtonProps {
	onClick: () => void
}

export default function WorkspaceButton({ onClick }: WorkspaceButtonProps) {
	const { userInfo } = useUserInfo()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	return (
		<Button
			variant="outline"
			size="sm"
			className="h-8 gap-2.5 rounded-lg border-black/[0.08] px-1.5 py-1.5 dark:border-white/[0.08]"
			onClick={onClick}
		>
			<div className="flex items-center gap-1">
				<div className="flex size-6 items-center justify-center rounded-[6px] bg-[#DDE7FF] p-[1.5px] dark:bg-blue-500/20">
					<UserAvatarRender
						userInfo={userInfo}
						size={24}
						className="size-6 rounded-[6px]"
					/>
				</div>
				{!isMobile && (
					<span className="text-sm font-normal leading-[1.43] text-foreground/80">
						{userInfo?.nickname || t("share.user")}
					</span>
				)}
			</div>
			<div className="h-3 w-0 border-l border-border" />
			<span className="text-sm font-normal leading-[1.43] text-foreground">
				{t("share.workspace")}
			</span>
		</Button>
	)
}

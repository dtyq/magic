import { useTranslation } from "react-i18next"
import Logo from "@/layouts/BaseLayout/components/Header/components/Logo"
import { Button } from "@/components/shadcn-ui/button"
import OrganizationSwitchState from "@/components/business/OrganizationSwitchState"
import type { User } from "@/types/user"
import WorkspaceButton from "../WorkspaceButton"
import FolderIcon from "../../assets/icon/folder_empty.svg"
import ReplayIcon from "../../assets/icon/replay_icon.svg"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { useUserInfo } from "@/models/user/hooks"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"

interface ShareEmptyStateProps {
	currentOrgName: string
	targetOrgName: string
	targetOrgLogo?: string
	userInfo: User.UserInfo | null
	onSwitch: () => void
	isLoading?: boolean
	isFileShare?: boolean
}

export default function ShareEmptyState({
	targetOrgName,
	userInfo: userInfoProp,
	onSwitch,
	isLoading = false,
	isFileShare = false,
}: ShareEmptyStateProps) {
	const { t } = useTranslation("super")
	const { userInfo } = useUserInfo()
	const isLogined = !!userInfo?.user_id

	// 根据分享类型选择图标
	const icon = isFileShare ? FolderIcon : ReplayIcon

	return (
		<div
			className="flex h-screen w-screen flex-col overflow-hidden bg-[#F9F9F9]"
			data-testid="share-empty-state"
		>
			{/* Keep the share header below the mobile safe area in standalone browsers. */}
			<div
				className="z-[99] flex h-12 items-center justify-between border-b border-border bg-white px-5 py-2.5 backdrop-blur-[50px] max-md:h-[calc(52px+var(--safe-area-inset-top,0px))] max-md:px-3 max-md:pb-0 max-md:pt-[var(--safe-area-inset-top,0px)]"
				data-testid="share-empty-state-header"
			>
				<Logo className="h-[42px] shrink-0 max-md:h-9" />
				<div className="flex gap-2">
					{isLogined ? (
						<WorkspaceButton
							onClick={() => {
								history.push({ name: RouteName.Super })
							}}
						/>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								authEventBus.emit(AuthEventName.RequestLogin, {
									reason: "manual",
									source: "share",
									returnTo: window.location.href,
									preserveQuery: true,
								})
							}}
							data-testid="share-empty-login-button"
						>
							{t("share.login")}
						</Button>
					)}
				</div>
			</div>

			<OrganizationSwitchState
				icon={icon}
				title={t("share.emptyState.title")}
				description={t("share.emptyState.switchTip", { orgName: targetOrgName })}
				userInfo={userInfoProp}
				actionLabel={t("share.emptyState.switchButton")}
				switchingLabel={t("share.emptyState.switching")}
				isSwitching={isLoading}
				onSwitch={onSwitch}
				testIdPrefix="share-empty-state"
				switchButtonTestId="share-empty-switch-button"
			/>
		</div>
	)
}

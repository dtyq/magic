import { Settings, Mail, Copyright } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import { toAboutUs } from "@/opensource/layouts/BaseLayoutMobile/utils/url"
import { isMagicApp } from "@/opensource/utils/devices"
import showOnlineFeedbackModal from "@/opensource/components/business/OnlineFeedbackModal"
import { isCommercial, isPrivateDeployment } from "@/opensource/utils/env"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"
import { useTranslation } from "react-i18next"
import MenuButton from "../MenuButton"

export default function SystemSettingsSection() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()

	const handleSettings = useMemoizedFn(() => {
		navigate({ name: RouteName.ProfileSettings })
	})

	const handleAboutUs = useMemoizedFn(() => {
		if (isMagicApp) {
			toAboutUs()
		}
	})

	const handleFeedback = useMemoizedFn(() => {
		showOnlineFeedbackModal()
	})

	return (
		<div className="flex w-full flex-col items-start gap-2">
			{/* 标题 */}
			<div className="flex w-full items-center justify-center px-1 py-0">
				<div className="flex-1 text-xs font-normal leading-4 text-foreground">
					{t("setting.systemSetting")}
				</div>
			</div>

			{/* 按钮组 */}
			<div className="flex w-full flex-col items-start overflow-hidden rounded-xl bg-fill">
				<MenuButton
					icon={<Settings className="size-4" />}
					label={t("sider.settings")}
					onClick={handleSettings}
				/>
				{isMagicApp && (
					<MenuButton
						icon={<Copyright className="size-4" />}
						label={t("setting.aboutUs")}
						onClick={handleAboutUs}
					/>
				)}
				{isCommercial() && !isPrivateDeployment() && (
					<MenuButton
						icon={<Mail className="size-4" />}
						label={t("sider.onlineFeedback")}
						onClick={handleFeedback}
					/>
				)}
			</div>
		</div>
	)
}

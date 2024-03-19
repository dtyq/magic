import { CircleUser, ShieldUser, MonitorSmartphone } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"
import MenuButton from "../MenuButton"

export default function AccountManagementSection() {
	const { t } = useTranslation("accountSetting")
	const navigate = useNavigate()
	const handlePersonalInfo = useMemoizedFn(() => {
		navigate({
			name: RouteName.ProfileInfo,
		})
	})

	const handleAccountSecurity = useMemoizedFn(() => {
		navigate({
			name: RouteName.ProfileAccountSecurity,
		})
	})

	const handleLoginDevices = useMemoizedFn(() => {
		navigate({
			name: RouteName.ProfileLoginDevices,
		})
	})

	return (
		<div className="flex w-full flex-col items-start gap-2">
			{/* 标题 */}
			<div className="flex w-full items-center justify-center px-1 py-0">
				<div className="flex-1 text-xs font-normal leading-4 text-foreground">
					{t("setting.accountManagement", { ns: "interface" })}
				</div>
			</div>

			{/* 按钮组 */}
			<div className="flex w-full flex-col items-start overflow-hidden rounded-xl bg-fill">
				<MenuButton
					icon={<CircleUser className="size-4" />}
					label={t("personalInfo")}
					onClick={handlePersonalInfo}
				/>
				<MenuButton
					icon={<ShieldUser className="size-4" />}
					label={t("accountSecurity")}
					onClick={handleAccountSecurity}
				/>
				<MenuButton
					icon={<MonitorSmartphone className="size-4" />}
					label={t("loginDevices")}
					onClick={handleLoginDevices}
				/>
			</div>
		</div>
	)
}

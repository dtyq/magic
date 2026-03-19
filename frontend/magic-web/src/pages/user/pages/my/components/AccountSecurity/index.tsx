import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useNavigate } from "@/routes/hooks/useNavigate"
import { Button } from "@/components/shadcn-ui/button"
import { useUserInfo } from "@/models/user/hooks"
import { useTranslation } from "react-i18next"
import { encryptPhoneWithCountryCode } from "@/utils/phone"
import SettingItem from "../common/SettingItem"
import ChangePhoneModal from "@/components/business/ChangePhoneModal"
import ChangePasswordModal from "@/components/business/ChangePasswordModal"

function AccountSecurity() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate()

	const [changePhoneOpen, setChangePhoneOpen] = useState(false)
	const [changePasswordOpen, setChangePasswordOpen] = useState(false)

	const { userInfo } = useUserInfo()

	// 返回上一页
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
		})
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">
						{t("setting.accountSecurity")}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex w-full flex-1 flex-col gap-4 overflow-y-auto px-3.5">
				{/* 手机号设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<SettingItem
						label={t("setting.phoneNumber")}
						description={t("setting.phoneDescription")}
						value={
							<div className="whitespace-nowrap text-sm text-foreground">
								{encryptPhoneWithCountryCode(
									userInfo?.phone || "",
									userInfo?.country_code || "+86",
								)}
							</div>
						}
						onClick={() => setChangePhoneOpen(true)}
					/>
				</div>

				{/* 登录密码设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<SettingItem
						label={t("setting.loginPassword")}
						value={
							<div className="whitespace-nowrap text-sm text-foreground">
								{t("setting.haseenSet")}
							</div>
						}
						onClick={() => setChangePasswordOpen(true)}
					/>
				</div>
			</div>

			{/* 修改手机号 Modal */}
			<ChangePhoneModal
				open={changePhoneOpen}
				onOpenChange={setChangePhoneOpen}
				currentPhone={userInfo?.phone || ""}
				defaultCountryCode={userInfo?.country_code || "+86"}
			/>

			{/* 修改登录密码 Modal */}
			<ChangePasswordModal
				open={changePasswordOpen}
				onOpenChange={setChangePasswordOpen}
				userPhone={userInfo?.phone}
				userEmail={userInfo?.email}
			/>
		</div>
	)
}

export default observer(AccountSecurity)

import { KeyRound, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"

import { encryptPhoneWithCountryCode } from "@/utils/phone"

import { MobileSettingsMenuSection } from "./MenuSection"
import { MobileSettingsSheetContainer } from "./SheetContainer"
import type { MobileSettingsMenuSectionConfig } from "../types"

interface MobileSettingsAccountSecuritySheetProps {
	open: boolean
	onClose: () => void
	phone?: string
	countryCode?: string
	onOpenPhone: () => void
	onOpenPassword: () => void
}

/** 账号安全浮层只承接当前已有真实契约的入口，避免在设置页伪造绑定/解绑能力。 */
export function MobileSettingsAccountSecuritySheet({
	open,
	onClose,
	phone,
	countryCode = "+86",
	onOpenPhone,
	onOpenPassword,
}: MobileSettingsAccountSecuritySheetProps) {
	const { t } = useTranslation("interface")
	const displayPhone = phone
		? encryptPhoneWithCountryCode(phone, countryCode)
		: t("setting.notBind")
	const canChangePhone = Boolean(phone)

	// TODO(mobile-refactor-cleanup): 绑定手机号、邮箱、微信、Apple 与 Google 入口需要等待账号绑定状态字段、
	// 绑定 API 与解绑 API 明确后再展示；当前只保留手机号和密码两个已有真实能力。
	// TODO(email-change-api): 更换邮箱需后端提供 PUT /v4/users/email（及 change_email/bind_email 发码 type）；
	// 落地后采用与 PhoneSecuritySheet 相同的单页 + Header 提交，本文件再增加邮箱入口。
	const sections: MobileSettingsMenuSectionConfig[] = [
		{
			key: "account-security-contact",
			items: [
				{
					icon: <Smartphone className="h-5 w-5" />,
					label: t("setting.phoneNumber"),
					value: displayPhone,
					onClick: onOpenPhone,
					disabled: !canChangePhone,
					chevron: canChangePhone,
					dataTestId: "mobile-settings-account-security-phone",
				},
			],
		},
		{
			key: "account-security-password",
			items: [
				{
					icon: <KeyRound className="h-5 w-5" />,
					label: t("setting.loginPassword"),
					value: t("setting.haseenSet"),
					onClick: onOpenPassword,
					dataTestId: "mobile-settings-account-security-password",
				},
			],
		},
	]

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.accountSecurity")}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			contentClassName="gap-2.5 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-account-security-sheet"
		>
			{sections.map((section) => (
				<MobileSettingsMenuSection key={section.key} items={section.items} />
			))}
		</MobileSettingsSheetContainer>
	)
}

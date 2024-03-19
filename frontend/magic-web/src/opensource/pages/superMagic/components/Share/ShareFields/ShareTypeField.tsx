import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { cn } from "@/opensource/lib/utils"
import { userStore } from "@/opensource/models/user"
import publicIcon from "../svg/public.svg"
import protectedIcon from "../svg/protected.svg"
import teamIcon from "../svg/team.svg"
import { ShareType } from "../types"
import VipIcon from "@/opensource/pages/superMagic/components/VipIcon"
import type { ShareTypeFieldProps } from "./types"

export default memo(function ShareTypeField(props: ShareTypeFieldProps) {
	const { value, onChange, availableTypes } = props

	const { t } = useTranslation("super")
	const [hoveredType, setHoveredType] = useState<ShareType | null>(null)

	// Check if user is personal organization
	const { isPersonalOrganization } = userStore.user

	const normalizedValue = useMemo(() => {
		return value
	}, [value])

	// Build share type list based on available types
	const shareTypeList = useMemo(() => {
		const list = [
			{
				type: ShareType.PasswordProtected,
				icon: protectedIcon,
				title: t("share.passwordProtected"),
				description: t("share.passwordProtectedDescription"),
			},
			{
				type: ShareType.Public,
				icon: publicIcon,
				title: t("share.publicAccess"),
				description: t("share.publicAccessDescription"),
			},
			{
				type: ShareType.Organization,
				icon: teamIcon,
				title: t("share.teamShare"),
				description: t("share.teamShareDescription"),
			},
		]

		return list.filter((item) => {
			// 个人版用户不显示团队可访问选项
			if (isPersonalOrganization && item.type === ShareType.Organization) {
				return false
			}
			// If Internet is in allowed types, show both Public and PasswordProtected
			return (
				item.type === ShareType.Public ||
				item.type === ShareType.PasswordProtected ||
				availableTypes.includes(item.type)
			)
		})
	}, [availableTypes, isPersonalOrganization, t])

	// Handle type change
	const handleTypeChange = (newType: ShareType) => {
		onChange(newType)
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="text-sm font-medium leading-none text-foreground">
				{t("share.shareMethod")}
			</div>
			<div className="flex flex-col gap-1">
				{shareTypeList.map((item) => {
					const isActive = item.type === normalizedValue
					const isPasswordProtected = item.type === ShareType.PasswordProtected

					// 个人版用户，密码保护为禁用状态
					const isDisabled = isPersonalOrganization && isPasswordProtected

					// 禁用状态始终显示 VIP Badge，否则在选中或悬浮时显示 Checkbox
					const showCheckbox = isDisabled || isActive || hoveredType === item.type

					return (
						<div
							key={item.type}
							className="rounded-xl"
							onMouseEnter={() => setHoveredType(item.type)}
							onMouseLeave={() => setHoveredType(null)}
						>
							<div
								className={cn(
									"flex cursor-pointer flex-row items-start gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-[#F5F5F5]",
								)}
								onClick={() => handleTypeChange(item.type)}
							>
								<div className="h-6 w-6 flex-shrink-0">
									<img
										src={item.icon}
										alt={item.title}
										className={cn(
											"h-full w-full",
											isDisabled && "opacity-40 grayscale",
										)}
									/>
								</div>
								<div className="flex flex-1 flex-col gap-1.5">
									<div
										className={cn(
											"text-sm font-medium leading-none",
											isDisabled ? "text-neutral-500" : "text-[#0A0A0A]",
										)}
									>
										{item.title}
									</div>
									<div
										className="text-xs text-neutral-500"
										style={{ lineHeight: "16px" }}
									>
										{item.description}
									</div>
								</div>
								<div
									className={cn(
										"transition-opacity duration-200",
										showCheckbox ? "opacity-100" : "opacity-0",
									)}
								>
									{isDisabled ? <VipIcon /> : <Checkbox checked={isActive} />}
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
})

import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import { userStore } from "@/models/user"
import publicIcon from "../svg/public.svg"
import protectedIcon from "../svg/protected.svg"
import teamIcon from "../svg/team.svg"
import { ShareType } from "../types"
import {
	isFreePlanFromSubscription,
	isShareTypePlanDisabled,
	isShareTypePlanHidden,
} from "../utils/sharePlanRestrictions"
import VipIcon from "@/pages/superMagic/components/VipIcon"
import type { ShareTypeFieldProps } from "./types"

export default memo(function ShareTypeField(props: ShareTypeFieldProps) {
	const { value, onChange, availableTypes, permittedTypes, preserveCurrentType = false } = props

	const { t } = useTranslation("super")
	const [hoveredType, setHoveredType] = useState<ShareType | null>(null)

	const isFreePlan = isFreePlanFromSubscription(userStore.user.organizationSubscriptionInfo)

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
			// 免费用户不显示团队可访问选项
			if (isShareTypePlanHidden(item.type, isFreePlan)) {
				return false
			}
			// If Internet is in allowed types, show both Public and PasswordProtected
			const isAvailable =
				item.type === ShareType.Public ||
				item.type === ShareType.PasswordProtected ||
				availableTypes.includes(item.type)
			if (!isAvailable) return false

			return (
				permittedTypes === undefined ||
				permittedTypes.includes(item.type) ||
				(preserveCurrentType && item.type === value)
			)
		})
	}, [availableTypes, isFreePlan, permittedTypes, preserveCurrentType, t, value])

	// Handle type change
	const handleTypeChange = (newType: ShareType) => {
		// A plan-disabled method is a real gate, not decoration: without this guard a free
		// organization could still select it and submit it, because the backend only validates
		// the function permission and never `is_paid_plan`.
		if (isShareTypePlanDisabled(newType, isFreePlan)) return
		if (permittedTypes && !permittedTypes.includes(newType)) return
		onChange(newType)
	}

	return (
		<div className="flex flex-col gap-2" data-testid="share-type-field">
			<div
				className="text-sm font-medium leading-none text-foreground"
				data-testid="share-type-field-label"
			>
				{t("share.shareMethod")}
			</div>
			<div className="flex flex-col gap-1" data-testid="share-type-list">
				{shareTypeList.map((item) => {
					const isActive = item.type === normalizedValue
					const isPermissionDisabled =
						permittedTypes !== undefined && !permittedTypes.includes(item.type)
					// 免费用户，密码保护为禁用状态
					const isPlanDisabled = isShareTypePlanDisabled(item.type, isFreePlan)

					// The two gates look the same when disabled but must never be explained the same
					// way: a plan gate can be lifted by upgrading, a permission gate cannot.
					const isDisabled = isPlanDisabled || isPermissionDisabled

					// 禁用状态始终显示右侧标识，否则在选中或悬浮时显示 Checkbox
					const showCheckbox = isDisabled || isActive || hoveredType === item.type

					return (
						<div
							key={item.type}
							className="rounded-xl"
							onMouseEnter={() => setHoveredType(item.type)}
							onMouseLeave={() => setHoveredType(null)}
							data-testid="set-hovered-type"
						>
							<div
								className={cn(
									"flex flex-row items-start gap-2 rounded-lg px-2.5 py-2 transition-colors",
									isDisabled
										? "cursor-not-allowed"
										: "cursor-pointer hover:bg-[#F5F5F5]",
								)}
								onClick={() => handleTypeChange(item.type)}
								aria-disabled={isDisabled}
								data-testid="handle-type-change"
								data-share-type={item.type}
							>
								<div className="h-6 w-6 flex-shrink-0">
									<img
										src={item.icon}
										alt={item.title}
										className={cn(
											"h-full w-full",
											isDisabled && "opacity-40 grayscale",
										)}
										data-testid="share-type-field-image"
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
									{/* Only the plan gate earns the VIP crown; a permission-disabled row keeps a
								    plain checkbox so nobody is sent to the upgrade page for a lock that
								    upgrading cannot open. */}
									{isPlanDisabled ? (
										<VipIcon />
									) : (
										<Checkbox
											checked={isActive}
											data-testid="share-type-field-checkbox"
										/>
									)}
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
})

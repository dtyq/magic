import { memo, useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import SmartTooltip from "@/components/other/SmartTooltip"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import { cn } from "@/lib/utils"
import type { MyCrewView } from "@/services/crew/CrewService"

interface MyCrewCardMainSectionProps {
	employee: MyCrewView
	actions: ReactNode
	/** Separator + footer row; kept inside pt-12 column for layout. */
	footer: ReactNode
	avatarClassName?: string
}

export const MyCrewCardMainSection = memo(function MyCrewCardMainSection({
	employee,
	actions,
	footer,
	avatarClassName,
}: MyCrewCardMainSectionProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const rawName = employee.name?.trim() || ""
	const displayName = rawName || t("crew/create:untitledCrew")
	const displayRole = employee.role?.trim() || ""
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const avatarUrl = typeof employee.icon === "string" ? employee.icon.trim() : ""
	const featureList = Array.isArray(employee.playbooks) ? employee.playbooks : []
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
	const showRemoteAvatar = Boolean(avatarUrl) && !avatarLoadFailed

	useEffect(() => {
		setAvatarLoadFailed(false)
	}, [avatarUrl])

	return (
		<>
			<div
				className={cn(
					"pointer-events-none absolute left-1/2 top-0 z-10 size-24 -translate-x-1/2 -translate-y-1/2",
					"overflow-hidden rounded-full border-[3px] border-popover bg-muted shadow-sm",
					avatarClassName,
				)}
				data-testid="my-crew-card-avatar-wrap"
			>
				{showRemoteAvatar ? (
					<img
						src={avatarUrl}
						alt=""
						className="size-full object-cover"
						loading="lazy"
						decoding="async"
						onError={() => setAvatarLoadFailed(true)}
					/>
				) : (
					<div className="flex size-full items-center justify-center bg-muted text-foreground">
						<CrewFallbackAvatar />
					</div>
				)}
			</div>

			<div className="flex min-h-0 flex-1 flex-col pt-12">
				<div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-4 pb-2">
					<SmartTooltip
						elementType="div"
						className="w-full text-center text-base font-semibold leading-6 text-foreground"
						content={displayName}
						maxLines={0}
						sideOffset={4}
					>
						{displayName}
					</SmartTooltip>
					{displayRole ? (
						<div className="flex w-full justify-center">
							<Badge
								variant="outline"
								className="w-fit min-w-0 max-w-full justify-center overflow-hidden rounded-md px-2 py-0.5 text-xs font-normal"
								data-testid="my-crew-card-role"
							>
								<SmartTooltip
									elementType="span"
									className="block min-w-0 max-w-full text-xs font-normal leading-4"
									content={displayRole}
									maxLines={1}
									sideOffset={4}
								>
									{displayRole}
								</SmartTooltip>
							</Badge>
						</div>
					) : null}
					<SmartTooltip
						elementType="div"
						className="w-full text-center text-sm leading-5 text-muted-foreground"
						content={displayDescription}
						maxLines={2}
						sideOffset={4}
					>
						{displayDescription}
					</SmartTooltip>

					{featureList.length > 0 ? (
						<div className="flex w-full flex-wrap justify-center gap-2">
							{featureList.map((feature, index) => (
								<Badge
									key={`${feature.name || "feature"}-${index}`}
									variant="outline"
									className="max-w-full rounded-md text-xs"
									data-testid="my-crew-card-feature-badge"
								>
									<SmartTooltip
										elementType="span"
										className="block min-w-0 max-w-full text-xs leading-4"
										content={feature.name || tCrewCreate("playbook.untitled")}
										sideOffset={4}
									>
										{feature.name || tCrewCreate("playbook.untitled")}
									</SmartTooltip>
								</Badge>
							))}
						</div>
					) : null}

					<div className="mt-auto w-full pt-2">{actions}</div>
				</div>

				{footer}
			</div>
		</>
	)
})

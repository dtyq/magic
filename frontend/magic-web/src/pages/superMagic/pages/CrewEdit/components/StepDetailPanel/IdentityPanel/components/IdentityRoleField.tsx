import { useTranslation } from "react-i18next"
import { PencilLine } from "lucide-react"
import { observer } from "mobx-react-lite"
import { Badge } from "@/components/shadcn-ui/badge"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useCrewEditStore } from "../../../../context"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"

interface IdentityRoleFieldProps {
	disabled?: boolean
	onClick?: () => void
}

function IdentityRoleFieldInner({ disabled = false, onClick }: IdentityRoleFieldProps) {
	const store = useCrewEditStore()
	const { identity, skills } = store
	const { t } = useTranslation("crew/create")
	const { role } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})
	const rolePlaceholder = t("card.enterRole")

	return (
		<button
			type="button"
			className="max-w-full rounded-md"
			onClick={onClick}
			disabled={disabled}
			data-testid="crew-member-role-input"
		>
			{role ? (
				<Badge className="max-w-full cursor-pointer rounded-md px-2 text-xs font-semibold">
					<SmartTooltip
						elementType="span"
						className="block max-w-full text-center text-xs font-semibold leading-4"
						content={role}
						sideOffset={4}
					>
						{role}
					</SmartTooltip>
				</Badge>
			) : (
				<Badge
					variant="outline"
					className="inline-flex h-auto max-w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-normal text-muted-foreground"
				>
					{rolePlaceholder}
					<PencilLine className="h-3.5 w-3.5 shrink-0" />
				</Badge>
			)}
		</button>
	)
}

export const IdentityRoleField = observer(IdentityRoleFieldInner)

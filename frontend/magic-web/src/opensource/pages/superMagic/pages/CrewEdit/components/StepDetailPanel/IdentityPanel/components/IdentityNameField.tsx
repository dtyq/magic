import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { InlineEditField } from "./InlineEditField"
import { useCrewEditStore } from "../../../../context"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"

interface IdentityNameFieldProps {
	disabled?: boolean
	onClick?: () => void
}

function IdentityNameFieldInner({ disabled = false, onClick }: IdentityNameFieldProps) {
	const store = useCrewEditStore()
	const { identity, skills } = store
	const { t } = useTranslation("crew/create")
	const { name } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})

	return (
		<InlineEditField
			value={name}
			placeholder={t("card.enterName")}
			textClassName="text-2xl leading-tight font-medium"
			displayTooltipContent={name || undefined}
			onSave={identity.setName}
			testId="crew-member-name-input"
			disabled={disabled}
			onClick={onClick}
		/>
	)
}

export const IdentityNameField = observer(IdentityNameFieldInner)

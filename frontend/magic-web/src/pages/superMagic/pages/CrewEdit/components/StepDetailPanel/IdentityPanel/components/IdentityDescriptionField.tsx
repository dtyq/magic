import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { InlineEditField } from "./InlineEditField"
import { useCrewEditStore } from "../../../../context"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"

interface IdentityDescriptionFieldProps {
	disabled?: boolean
	onClick?: () => void
}

function IdentityDescriptionFieldInner({
	disabled = false,
	onClick,
}: IdentityDescriptionFieldProps) {
	const store = useCrewEditStore()
	const { identity, skills } = store
	const { t } = useTranslation("crew/create")
	const { description } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})

	return (
		<div className="flex flex-col items-center gap-2.5">
			<p className="font-medium text-foreground" style={{ fontSize: 32 }}>
				{t("card.description")}
			</p>
			<InlineEditField
				value={description}
				placeholder={t("card.enterDescription")}
				textClassName="text-sm leading-relaxed"
				displayTextClassName="line-clamp-4"
				multiline
				multilineRows={4}
				onSave={identity.setDescription}
				testId="crew-member-description-input"
				disabled={disabled}
				onClick={onClick}
			/>
		</div>
	)
}

export const IdentityDescriptionField = observer(IdentityDescriptionFieldInner)

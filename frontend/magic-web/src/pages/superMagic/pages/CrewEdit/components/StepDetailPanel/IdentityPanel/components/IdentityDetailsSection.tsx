import { observer } from "mobx-react-lite"
import { IdentityDescriptionField } from "./IdentityDescriptionField"
import { IdentitySkillsSection } from "./IdentitySkillsSection"

interface IdentityDetailsSectionProps {
	disabled?: boolean
	onOpenLocalize?: (tab: "description") => void
}

function IdentityDetailsSectionInner({
	disabled = false,
	onOpenLocalize,
}: IdentityDetailsSectionProps) {
	return (
		<div className="flex flex-1 flex-col gap-6">
			<IdentitySkillsSection disabled={disabled} />
			<IdentityDescriptionField
				disabled={disabled}
				onClick={onOpenLocalize ? () => onOpenLocalize("description") : undefined}
			/>
		</div>
	)
}

export const IdentityDetailsSection = observer(IdentityDetailsSectionInner)

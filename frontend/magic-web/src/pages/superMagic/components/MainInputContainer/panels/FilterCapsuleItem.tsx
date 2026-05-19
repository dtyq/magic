import { useLocaleText } from "./hooks/useLocaleText"
import type { FieldItem, OptionItem } from "./types"
import { isOptionGroup } from "./utils"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { observer } from "mobx-react-lite"
import CollapsiblePanel from "./CollapsiblePanel"
import TemplateCapsule from "./capsule/TemplateCapsule"

interface FilterCapsuleItemProps {
	filter: FieldItem
	onFilterChange?: (filterId: string, value: string) => void
	variant?: ScenePanelVariant
}

/**
 * FilterSelectItem - renders a single filter field.
 * Desktop: shadcn Select dropdown.
 * Mobile: ActionDrawer with option list + Reset/Confirm buttons.
 */
function FilterCapsuleItem({ filter, onFilterChange }: FilterCapsuleItemProps) {
	const lt = useLocaleText()
	const flatOptions = filter.options.filter((opt): opt is OptionItem => !isOptionGroup(opt))

	const selectedOption = flatOptions.find((opt) => opt.value === filter.current_value)

	// Desktop: shadcn Select
	return (
		<CollapsiblePanel title={lt(filter.label)} expandable defaultExpanded>
			<TemplateCapsule
				selectedTemplate={selectedOption}
				templates={flatOptions}
				onTemplateClick={(template) =>
					onFilterChange?.(filter.data_key, lt(template.value) ?? "")
				}
			/>
		</CollapsiblePanel>
	)
}

export default observer(FilterCapsuleItem)

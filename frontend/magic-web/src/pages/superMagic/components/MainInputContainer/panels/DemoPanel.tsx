import { useMemo, useEffect } from "react"
import { observer } from "mobx-react-lite"
import CollapsiblePanel from "./CollapsiblePanel"
import TemplateViewSwitcher from "./TemplateViewSwitcher"
import TemplateGroupSelector from "./TemplateGroupSelector"
import { useLocaleText } from "./hooks/useLocaleText"
import type { DemoPanelConfig, OptionItem } from "./types"
import { DemoPanelStore } from "../stores/DemoPanelStore"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useTranslation } from "react-i18next"

interface DemoPanelProps {
	config: DemoPanelConfig
	onTemplateSelect?: (template: OptionItem) => void
}

const DemoPanel = observer(({ config, onTemplateSelect }: DemoPanelProps) => {
	const lt = useLocaleText()
	const { t } = useTranslation("crew/create")

	// Create store instance for this component
	const store = useMemo(() => new DemoPanelStore(), [])

	// Initialize store when config changes
	useEffect(() => {
		store.initialize(config)
	}, [config, store])

	const handleTemplateClick = (template: OptionItem) => {
		onTemplateSelect?.(template)
		pubsub.publish(PubSubEvents.Set_Demo_Text_To_Input, template.value)
	}

	const handleGroupChange = (groupKey: string) => {
		store.setCurrentGroupKey(groupKey)
	}

	const noData =
		config.demo?.groups?.length === 0 ||
		config.demo?.groups?.every((group) => group.children?.length === 0)

	if (noData) {
		return null
	}

	return (
		<CollapsiblePanel
			title={lt(config.title) || t("playbook.edit.inspiration.title")}
			expandable={config.expandable}
			defaultExpanded={config.default_expanded}
			expanded={store.isExpanded}
			onExpandedChange={(open) => store.setExpanded(open)}
		>
			{store.hasMultipleGroups && (
				<TemplateGroupSelector
					groups={config.demo.groups}
					selectedGroupKey={store.currentGroupKey}
					onGroupChange={handleGroupChange}
				/>
			)}
			<TemplateViewSwitcher
				viewType={config.demo?.view_type}
				items={store.filteredTemplates}
				onTemplateClick={handleTemplateClick}
			/>
		</CollapsiblePanel>
	)
})

DemoPanel.displayName = "DemoPanel"

export default DemoPanel

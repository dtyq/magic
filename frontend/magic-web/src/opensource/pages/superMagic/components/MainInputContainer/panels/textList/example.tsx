/**
 * Example usage of TemplateTextList component
 * Demonstrates the text_list view type for templates
 */

import TemplateTextList from "./TemplateTextList"
import type { OptionItem, FieldPanelConfig } from "../types"
import { OptionViewType, SkillPanelType } from "../types"

// Example templates for text list view
const exampleTemplates: OptionItem[] = [
	{
		value: "identify-speakers",
		label: "Identify key positions and demands for each speaker from this discussion.",
		description: "Analyze speaker positions and demands",
	},
	{
		value: "extract-concepts",
		label: "Extract core concepts from this lecture and provide a plain-English breakdown for each.",
		description: "Break down core concepts",
	},
	{
		value: "structure-report",
		label: "Structure this recording into a formal research report (Background, Observations, and Recommendations).",
		description: "Create research report structure",
	},
]

// Example configuration with text_list view type
export const textListPanelConfig: FieldPanelConfig = {
	type: SkillPanelType.FIELD,
	title: "Quick Start",
	expandable: true,
	default_expanded: true,
	template_view_type: OptionViewType.TEXT_LIST,
	template_groups: [
		{
			group_key: "quick-start",
			group_name: "Quick Start Templates",
			children: exampleTemplates,
		},
	],
}

// Example component usage
export function TextListExample() {
	const handleTemplateClick = (template: OptionItem) => {
		console.log("Template clicked:", template)
	}

	return (
		<div className="w-full max-w-2xl p-4">
			<h2 className="mb-4 text-lg font-semibold">Text List View Example</h2>
			<TemplateTextList templates={exampleTemplates} onTemplateClick={handleTemplateClick} />
		</div>
	)
}

export default TextListExample

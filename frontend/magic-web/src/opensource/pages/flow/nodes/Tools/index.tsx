import ToolsV0 from "./v0"
import ToolsHeaderRightV0 from "./v0/components/ToolsHeaderRight"
import { v0Template } from "./v0/template"

export const ToolsComponentVersionMap = {
	v0: {
		component: () => <ToolsV0 />,
		headerRight: <ToolsHeaderRightV0 />,
		template: v0Template,
	},
}

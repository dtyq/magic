import SubFlowV0 from "./v0"
import SubFlowHeaderRightV0 from "./v0/components/SubFlowHeaderRight"
import { v0Template } from "./v0/template"

export const SubFlowComponentVersionMap = {
	v0: {
		component: () => <SubFlowV0 />,
		headerRight: <SubFlowHeaderRightV0 />,
		template: v0Template,
	},
}

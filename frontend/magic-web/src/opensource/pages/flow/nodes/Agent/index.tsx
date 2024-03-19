import CommonHeaderRight from "../../common/CommonHeaderRight"
import AgentV0 from "./v0"
import { v0Template } from "./v0/template"

export const AgentComponentVersionMap = {
	v0: {
		component: () => <AgentV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

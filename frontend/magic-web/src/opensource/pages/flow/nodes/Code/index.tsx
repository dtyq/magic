import CodeV0 from "./v0"
import CodeHeaderRightV0 from "./v0/components/CodeHeaderRight"
import { v0Template } from "./v0/template"

export const CodeComponentVersionMap = {
	v0: {
		component: () => <CodeV0 />,
		headerRight: <CodeHeaderRightV0 />,
		template: v0Template,
	},
}

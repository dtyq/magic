import InstructionsV0 from "./v0"
import { v0Template } from "./v0/template"

export const InstructionsComponentVersionMap = {
	v0: {
		component: () => <InstructionsV0 />,
		headerRight: null,
		template: v0Template,
	},
}

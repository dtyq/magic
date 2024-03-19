import CommonHeaderRight from "../../common/CommonHeaderRight"
import EndV0 from "./v0"
import { v0Template } from "./v0/template"

export const EndComponentVersionMap = {
	v0: {
		component: () => <EndV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

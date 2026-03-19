import CommonHeaderRight from "../../common/CommonHeaderRight"
import StartV0 from "./v0"
import { v0Template } from "./v0/template"
import StartV1 from "./v1"
import { v1Template } from "./v1/template"

export const StartComponentVersionMap = {
	v0: {
		component: () => <StartV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
	v1: {
		component: () => <StartV1 />,
		headerRight: <CommonHeaderRight />,
		template: v1Template,
	},
}

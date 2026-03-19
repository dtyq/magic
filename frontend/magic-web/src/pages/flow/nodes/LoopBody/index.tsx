import CommonHeaderRight from "../../common/CommonHeaderRight"
import LoopBodyV0 from "./v0"
import { v0Template } from "./v0/template"

export const LoopBodyComponentVersionMap = {
	v0: {
		component: () => <LoopBodyV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

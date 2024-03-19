import CommonHeaderRight from "../../common/CommonHeaderRight"
import LoopV0 from "./v0"
import { v0Template } from "./v0/template"
export const LoopComponentVersionMap = {
	v0: {
		component: () => <LoopV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

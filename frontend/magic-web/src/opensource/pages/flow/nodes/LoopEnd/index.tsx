import CommonHeaderRight from "../../common/CommonHeaderRight"
import LoopEndV0 from "./v0"
import { v0Template } from "./v0/template"

export const LoopEndComponentVersionMap = {
	v0: {
		component: () => <LoopEndV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

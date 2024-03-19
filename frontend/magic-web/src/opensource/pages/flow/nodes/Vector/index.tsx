import CommonHeaderRight from "../../common/CommonHeaderRight"
import VectorV0 from "./v0"
import { v0Template } from "./v0/template"

export const VectorComponentVersionMap = {
	v0: {
		component: () => <VectorV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

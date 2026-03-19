import CommonHeaderRight from "../../common/CommonHeaderRight"
import VectorDatabaseMatchV0 from "./v0/VectorDatabaseMatch"
import { v0Template } from "./v0/template"
export const VectorDatabaseMatchComponentVersionMap = {
	v0: {
		component: () => <VectorDatabaseMatchV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

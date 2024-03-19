import CommonHeaderRight from "../../common/CommonHeaderRight"
import BranchV0 from "./v0"
import { v0Template } from "./v0/template"

export const BranchComponentVersionMap = {
	v0: {
		component: () => <BranchV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

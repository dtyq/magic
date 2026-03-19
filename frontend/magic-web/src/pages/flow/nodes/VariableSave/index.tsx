import CommonHeaderRight from "../../common/CommonHeaderRight"
import VariableSaveV0 from "./v0"
import { v0Template } from "./v0/template"

export const VariableSaveComponentVersionMap = {
	v0: {
		component: () => <VariableSaveV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

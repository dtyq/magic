import ExcelV0 from "./v0"
import ExcelTestBtnV0 from "./v0/components/ExcelHeaderRight"
import { v0Template } from "./v0/template"
export const ExcelComponentVersionMap = {
	v0: {
		component: () => <ExcelV0 />,
		headerRight: <ExcelTestBtnV0 />,
		template: v0Template,
	},
}

import CommonHeaderRight from "../../common/CommonHeaderRight"
import TextSplitV0 from "./v0/TextSplit"
import { v0Template } from "./v0/template"
export const TextSplitComponentVersionMap = {
	v0: {
		component: () => <TextSplitV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

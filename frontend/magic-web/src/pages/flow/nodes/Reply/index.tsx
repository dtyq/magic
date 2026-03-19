import CommonHeaderRight from "../../common/CommonHeaderRight"
import ReplyV0 from "./v0"
import { v0Template } from "./v0/template"
export const ReplyComponentVersionMap = {
	v0: {
		component: () => <ReplyV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

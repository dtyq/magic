import CommonHeaderRight from "../../common/CommonHeaderRight"
import MessageSearchV0 from "./v0"
import { v0Template } from "./v0/template"

export const MessageSearchComponentVersionMap = {
	v0: {
		component: () => <MessageSearchV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

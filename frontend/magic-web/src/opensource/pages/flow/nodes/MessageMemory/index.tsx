import CommonHeaderRight from "../../common/CommonHeaderRight"
import MessageMemoryV0 from "./v0"
import { v0Template } from "./v0/template"

export const MessageMemoryComponentVersionMap = {
	v0: {
		component: () => <MessageMemoryV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

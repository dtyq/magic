import CommonHeaderRight from "../../common/CommonHeaderRight"
import WaitForReplyV0 from "./v0/WaitForReply"
import WaitForReplyV1 from "./v1/WaitForReply"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const WaitForReplyComponentVersionMap = {
	v0: {
		component: () => <WaitForReplyV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
	v1: {
		component: () => <WaitForReplyV1 />,
		headerRight: <CommonHeaderRight />,
		template: v1Template,
	},
}

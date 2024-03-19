import CommonHeaderRight from "../../common/CommonHeaderRight"
import GroupChatV0 from "./v0/GroupChat"
import { v0Template } from "./v0/template"

export const GroupChatComponentVersionMap = {
	v0: {
		component: () => <GroupChatV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

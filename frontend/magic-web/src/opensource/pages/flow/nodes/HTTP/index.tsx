import HTTPNodeV0 from "./v0"
import HTTPHeaderRightV0 from "./v0/components/HTTPHeaderRight"
import HTTPNodeV1 from "./v1"
import HTTPHeaderRightV1 from "./v1/components/HTTPHeaderRight"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const HTTPComponentVersionMap = {
	v0: {
		component: () => <HTTPNodeV0 />,
		headerRight: <HTTPHeaderRightV0 />,
		template: v0Template,
	},
	v1: {
		component: () => <HTTPNodeV1 />,
		headerRight: <HTTPHeaderRightV1 />,
		template: v1Template,
	},
}

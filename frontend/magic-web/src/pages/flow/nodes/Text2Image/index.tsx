import Text2ImageHeaderRightV0 from "./v0/components/Text2ImageHeaderRight"
import Text2ImageV0 from "./v0/Text2Image"
import Text2ImageHeaderRightV1 from "./v1/components/Text2ImageHeaderRight"
import Text2ImageV1 from "./v1/Text2Image"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const Text2ImageComponentVersionMap = {
	v0: {
		component: () => <Text2ImageV0 />,
		headerRight: <Text2ImageHeaderRightV0 />,
		template: v0Template,
	},
	v1: {
		component: () => <Text2ImageV1 />,
		headerRight: <Text2ImageHeaderRightV1 />,
		template: v1Template,
	},
}

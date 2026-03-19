import VectorSearchV0 from "./v0"
import VectorSearchHeaderRightV0 from "./v0/components/VectorSearchHeaderRight"
import VectorSearchV1 from "./v1"
import VectorSearchHeaderRightV1 from "./v1/components/VectorSearchHeaderRight"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const VectorSearchComponentVersionMap = {
	v0: {
		component: () => <VectorSearchV0 />,
		headerRight: <VectorSearchHeaderRightV0 />,
		template: v0Template,
	},
	v1: {
		component: () => <VectorSearchV1 />,
		headerRight: <VectorSearchHeaderRightV1 />,
		template: v1Template,
	},
}

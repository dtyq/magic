import VectorDeleteV0 from "./v0"
import VectorDeleteHeaderRightV0 from "./v0/components/VectorDeleteHeaderRight"
import { v0Template } from "./v0/template"
export const VectorDeleteComponentVersionMap = {
	v0: {
		component: () => <VectorDeleteV0 />,
		headerRight: <VectorDeleteHeaderRightV0 />,
		template: v0Template,
	},
}

import LoaderV0 from "./v0"
import LLMCallHeaderRightV0 from "./v0/components/LoaderHeaderRight"
import LoaderV1 from "./v1"
import LLMCallHeaderRightV1 from "./v1/components/LLMCallHeaderRight"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const LoaderComponentVersionMap = {
	v0: {
		component: () => <LoaderV0 />,
		headerRight: <LLMCallHeaderRightV0 />,
		template: v0Template,
	},
	v1: {
		component: () => <LoaderV1 />,
		headerRight: <LLMCallHeaderRightV1 />,
		template: v1Template,
	},
}

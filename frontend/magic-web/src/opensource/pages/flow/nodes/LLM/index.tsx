import LLMV0 from "./v0"
import LLMHeaderRightV0 from "./v0/components/LLMHeaderRight"
import LLMV1 from "./v1"
import LLMHeaderRightV1 from "./v1/components/LLMHeaderRight"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const LLMComponentVersionMap = {
	v0: {
		component: () => <LLMV0 />,
		headerRight: <LLMHeaderRightV0 />,
		template: v0Template,
	},
	v1: {
		component: () => <LLMV1 />,
		headerRight: <LLMHeaderRightV1 />,
		template: v1Template,
	},
}

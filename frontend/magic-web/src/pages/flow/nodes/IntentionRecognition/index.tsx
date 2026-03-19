import IntentionRecognitionV0 from "./v0"
import IntentionRecognitionHeaderRightV0 from "./v0/components/IntentionRecognitionHeaderRight"
import { v0Template } from "./v0/template"

export const IntentionRecognitionComponentVersionMap = {
	v0: {
		component: () => <IntentionRecognitionV0 />,
		headerRight: <IntentionRecognitionHeaderRightV0 />,
		template: v0Template,
	},
}

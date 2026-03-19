import CommonHeaderRight from "../../common/CommonHeaderRight"
import CacheGetterV0 from "./v0/CacheGetter"
import { v0Template } from "./v0/template"
import CacheGetterV1 from "./v1/CacheGetter"
import { v1Template } from "./v1/template"

export const CacheGetterComponentVersionMap = {
	v0: {
		component: () => <CacheGetterV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
	v1: {
		component: () => <CacheGetterV1 />,
		headerRight: <CommonHeaderRight />,
		template: v1Template,
	},
}

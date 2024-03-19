import CommonHeaderRight from "../../common/CommonHeaderRight"
import CacheSetterV0 from "./v0/CacheSetter"
import { v0Template } from "./v0/template"

export const CacheSetterComponentVersionMap = {
	v0: {
		component: () => <CacheSetterV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
}

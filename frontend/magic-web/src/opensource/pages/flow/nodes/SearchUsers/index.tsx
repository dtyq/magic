import CommonHeaderRight from "../../common/CommonHeaderRight"
import SearchUsersV0 from "./v0/SearchUsers"
import SearchUsersV1 from "./v1/SearchUsers"
import { v0Template } from "./v0/template"
import { v1Template } from "./v1/template"

export const SearchUsersComponentVersionMap = {
	v0: {
		component: () => <SearchUsersV0 />,
		headerRight: <CommonHeaderRight />,
		template: v0Template,
	},
	v1: {
		component: () => <SearchUsersV1 />,
		headerRight: <CommonHeaderRight />,
		template: v1Template,
	},
}

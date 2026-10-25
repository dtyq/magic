import type {
	ContactDepartment,
	ContactTokenPage,
	ContactUser,
} from "@magic-admin-v2/api/contact-organization/types"

export type DataDashboardContactDepartment = ContactDepartment
export type DataDashboardContactUser = ContactUser
export type DataDashboardContactPage<TItem> = ContactTokenPage<TItem>

export type DataDashboardContactDepartmentChildrenParams = {
	departmentId?: string
	pageToken?: string
	sumType?: 1 | 2
}

export type DataDashboardContactDepartmentUsersParams = {
	departmentId?: string
	pageToken?: string
	recursive?: 0 | 1
}

export type DataDashboardContactUserSearchParams = {
	pageToken?: string
	query: string
	queryType?: 1 | 2 | 3
	filterAgent?: 0 | 1
}

export type DataDashboardContactDepartmentSearchParams = {
	pageToken?: string
	name: string
	sumType?: 1 | 2
}

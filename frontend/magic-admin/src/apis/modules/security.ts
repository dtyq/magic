import type { PageParams, WithPageStatus } from "@/types/common"
import type { Security } from "@/types/security"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"
import { genRequestUrl } from "../utils"

export const generateSecurityApi = (client: HttpClient) => {
	return {
		getAdminOperationLogs(params: Security.AdminOperationLogsParams) {
			return client.get<{ total: number; list: any[] }>(
				genRequestUrl(RequestUrl.getAdminOperationLogs, {}, { ...params }),
			)
		},
		/* 获取组织管理员列表 */
		getAdminList(params: Security.AdminUserParams) {
			return client.get<WithPageStatus<Security.AdminUser>>(
				genRequestUrl(RequestUrl.getAdminList, {}, { ...params }),
			)
		},

		/** 启用组织管理员 */
		enableAdmin(id: string) {
			return client.post<null>(genRequestUrl(RequestUrl.enableAdmin, { id }))
		},

		/** 禁用组织管理员 */
		disableAdmin(id: string) {
			return client.post<null>(genRequestUrl(RequestUrl.disableAdmin, { id }))
		},

		/** 授予用户超级管理员权限 */
		grantSuperAdmin(data: { user_id: string }) {
			return client.post<null>(RequestUrl.grantSuperAdmin, data)
		},

		/** 删除组织管理员 */
		deleteAdmin(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteAdmin, { id }))
		},

		/** 转让组织创建人 */
		transferOrganizationCreator(data: { user_id: string }) {
			return client.post<null>(RequestUrl.transferOrganizationCreator, data)
		},

		/** 获取权限资源树 */
		getPermissionTree() {
			return client.get<Security.PermissionTree[]>(RequestUrl.getPermissionTree)
		},

		/** 获取子管理员列表 */
		getSubAdminList(params: PageParams) {
			return client.get<WithPageStatus<Security.SubAdmin>>(
				genRequestUrl(RequestUrl.getSubAdminList, {}, { ...params }),
			)
		},

		/* 创建子管理员 */
		createSubAdmin(data: Security.AddSubAdminParams) {
			return client.post<null>(RequestUrl.getSubAdminList, data)
		},

		/** 查看子管理员 */
		getSubAdmin(id: string) {
			return client.get<Security.SubAdmin>(genRequestUrl(RequestUrl.getSubAdmin, { id }))
		},

		/* 删除子管理员 */
		deleteSubAdmin(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.getSubAdmin, { id }))
		},

		/* 编辑子管理员 */
		updateSubAdmin(id: string, data: Security.AddSubAdminParams) {
			return client.put<null>(genRequestUrl(RequestUrl.getSubAdmin, { id }), data)
		},

		/* 获取我的权限列表 */
		getMyPermissionList() {
			return client.get<{ permission_key: string[] }>(RequestUrl.getMyPermissionList)
		},
	}
}

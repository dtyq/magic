import type { WithPage } from "@/types/common"
import type { AppMenu } from "@/types/appMenu"
import { RequestUrl } from "../constant"
import type { HttpClient } from "../core/HttpClient"

export const generateAppMenuApi = (client: HttpClient) => {
	return {
		/** 分页查询应用菜单列表 */
		getAppMenuList(params: AppMenu.GetListParams) {
			return client.post<WithPage<AppMenu.MenuItem>>(RequestUrl.getAppMenuList, params)
		},

		/** 保存应用菜单（有 id 则编辑，无 id 则新增） */
		saveAppMenu(data: AppMenu.SaveParams) {
			return client.post<AppMenu.MenuItem>(RequestUrl.saveAppMenu, data)
		},

		/** 删除应用菜单 */
		deleteAppMenu(id: string) {
			return client.post<boolean>(RequestUrl.deleteAppMenu, { id })
		},

		/** 设置应用菜单状态（启用/禁用） */
		updateAppMenuStatus(id: string, status: AppMenu.Status) {
			return client.post<AppMenu.MenuItem>(RequestUrl.updateAppMenuStatus, { id, status })
		},
	}
}

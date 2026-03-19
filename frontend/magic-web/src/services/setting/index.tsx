import { MagicUserApi } from "@/apis"
import SettingStore from "@/stores/setting"

class SettingService {
	/**
	 * 获取是否可以更新用户信息
	 */
	async getUpdateUserInfoPermission() {
		const res = await MagicUserApi.getUserUpdatePermission()
		SettingStore.setHasUpdateUserInfoPermission(res)
	}
}

export default new SettingService()

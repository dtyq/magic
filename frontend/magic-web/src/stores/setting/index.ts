import { UpdateUserInfoPermission } from "@/apis/modules/magic-user"
import { makeAutoObservable } from "mobx"

class SettingStore {
	/**
	 * 是否可以更新用户信息
	 */
	hasUpdateUserInfoPermission: UpdateUserInfoPermission[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
		this.hasUpdateUserInfoPermission = []
	}

	get canUpdateNickname() {
		return this.hasUpdateUserInfoPermission.includes("nickname")
	}
	get canUpdateAvatar() {
		return this.hasUpdateUserInfoPermission.includes("avatar_url")
	}

	get canUpdateUserInfo() {
		return this.canUpdateNickname || this.canUpdateAvatar
	}

	/**
	 * 设置是否可以更新用户信息
	 * @param hasUpdateUserInfoPermission 是否可以更新用户信息
	 */
	setHasUpdateUserInfoPermission(hasUpdateUserInfoPermission: UpdateUserInfoPermission[]) {
		this.hasUpdateUserInfoPermission = hasUpdateUserInfoPermission
	}
}

export default new SettingStore()

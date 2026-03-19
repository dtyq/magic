import { userStore } from "@/models/user"
import { User } from "@/types/user"
import type { PendingSwitchOperation } from "./modalStateManager"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("stateValidator")

/**
 * 状态验证结果
 */
export interface ValidationResult {
	isValid: boolean
	reason?: string
}

/**
 * 最新状态快照
 */
export interface LatestState {
	currentUserInfo: User.UserInfo | null
	currentOrganizationCode: string | null
	accounts: User.UserAccount[]
}

/**
 * 获取最新状态快照
 */
export function getLatestState(): LatestState {
	return {
		currentUserInfo: userStore.user.userInfo,
		currentOrganizationCode: userStore.user.organizationCode,
		accounts: userStore.account.accounts,
	}
}

/**
 * 验证切换操作是否仍然有效
 */
export function validateSwitchOperation(operation: PendingSwitchOperation): ValidationResult {
	const state = getLatestState()

	// 验证组织切换操作
	if (operation.type === "organization") {
		const targetUserInfo = operation.data.userInfo
		const targetOrganizationCode = operation.data.magicOrganizationCode

		if (!targetUserInfo || !targetOrganizationCode) {
			return {
				isValid: false,
				reason: "缺少必要的操作数据",
			}
		}

		// 检查目标账号是否存在
		const targetAccountExists = state.accounts.some(
			(acc) => acc.magic_id === targetUserInfo.magic_id,
		)

		if (!targetAccountExists) {
			return {
				isValid: false,
				reason: "目标账号不存在",
			}
		}

		// 检查当前状态是否已与目标状态一致
		if (
			state.currentUserInfo &&
			state.currentUserInfo.magic_id === targetUserInfo.magic_id &&
			state.currentUserInfo.user_id === targetUserInfo.user_id &&
			state.currentOrganizationCode === targetOrganizationCode
		) {
			return {
				isValid: false,
				reason: "当前状态已与目标状态一致",
			}
		}

		return {
			isValid: true,
		}
	}

	// 验证账号切换操作
	if (operation.type === "account") {
		const targetMagicId = operation.data.magicId
		const targetOrganizationCode = operation.data.magicOrganizationCode

		if (!targetMagicId || !targetOrganizationCode) {
			return {
				isValid: false,
				reason: "缺少必要的操作数据",
			}
		}

		// 检查目标账号是否存在
		const targetAccountExists = state.accounts.some((acc) => acc.magic_id === targetMagicId)

		if (!targetAccountExists) {
			return {
				isValid: false,
				reason: "目标账号不存在",
			}
		}

		// 检查当前状态是否已与目标状态一致
		if (
			state.currentUserInfo &&
			state.currentUserInfo.magic_id === targetMagicId &&
			state.currentOrganizationCode === targetOrganizationCode
		) {
			return {
				isValid: false,
				reason: "当前状态已与目标状态一致",
			}
		}

		return {
			isValid: true,
		}
	}

	return {
		isValid: false,
		reason: "未知的操作类型",
	}
}

/**
 * 判断是否应该显示弹窗
 */
export function shouldShowModal(
	operation: PendingSwitchOperation,
	currentUserInfo: User.UserInfo | null,
	currentOrganizationCode: string | null,
): boolean {
	if (!currentUserInfo) {
		return false
	}

	if (operation.type === "organization") {
		const targetUserInfo = operation.data.userInfo
		const targetOrganizationCode = operation.data.magicOrganizationCode

		if (!targetUserInfo || !targetOrganizationCode) {
			return false
		}

		// 同账号下切换组织
		return (
			currentUserInfo.magic_id === targetUserInfo.magic_id &&
			(currentUserInfo.user_id !== targetUserInfo.user_id ||
				currentOrganizationCode !== targetOrganizationCode)
		)
	}

	if (operation.type === "account") {
		const targetMagicId = operation.data.magicId

		if (!targetMagicId) {
			return false
		}

		// 跨账号切换
		return currentUserInfo.magic_id !== targetMagicId
	}

	return false
}

/**
 * 检查账号是否被删除
 */
export function isAccountDeleted(magicId: string): boolean {
	const accounts = userStore.account.accounts
	return !accounts.some((acc) => acc.magic_id === magicId)
}

/**
 * 检查目标账号是否被删除
 */
export function isTargetAccountDeleted(operation: PendingSwitchOperation): boolean {
	if (operation.type === "organization") {
		const targetMagicId = operation.data.userInfo?.magic_id
		if (!targetMagicId) {
			return true
		}
		return isAccountDeleted(targetMagicId)
	}

	if (operation.type === "account") {
		const targetMagicId = operation.data.magicId
		if (!targetMagicId) {
			return true
		}
		return isAccountDeleted(targetMagicId)
	}

	return false
}

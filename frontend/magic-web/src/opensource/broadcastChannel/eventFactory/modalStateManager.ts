import MagicModal from "@/opensource/components/base/MagicModal"
import { reaction } from "mobx"
import { userStore } from "@/opensource/models/user"
import { User } from "@/opensource/types/user"
import { logger as Logger } from "@/opensource/utils/log"

const logger = Logger.createLogger("modalStateManager")

/**
 * 待处理的切换操作
 */
export interface PendingSwitchOperation {
	type: "organization" | "account"
	data: {
		userInfo?: User.UserInfo
		magicOrganizationCode?: string
		magicId?: string
		magicUserId?: string
	}
	timestamp: number
	eventId: string // 用于去重
}

/**
 * 弹窗状态管理器
 * 统一管理组织切换和账号切换弹窗的状态
 */
export class ModalStateManager {
	private static instance: ModalStateManager | null = null

	private organizationModal: ReturnType<typeof MagicModal.confirm> | null = null
	private accountModal: ReturnType<typeof MagicModal.confirm> | null = null
	private pendingOperation: PendingSwitchOperation | null = null
	private accountReactionCancel: (() => void) | null = null
	private accountListReactionCancel: (() => void) | null = null
	private eventQueue: Map<string, PendingSwitchOperation> = new Map()

	private constructor() {
		this.setupAccountListReaction()
	}

	/**
	 * 获取单例实例
	 */
	public static getInstance(): ModalStateManager {
		if (!ModalStateManager.instance) {
			ModalStateManager.instance = new ModalStateManager()
		}
		return ModalStateManager.instance
	}

	/**
	 * 设置账号列表变化监听
	 */
	private setupAccountListReaction(): void {
		// 清理之前的 reaction（如果存在）
		this.accountListReactionCancel?.()

		// 创建新的 reaction
		this.accountListReactionCancel = reaction(
			() => userStore.account.accounts.length,
			() => {
				this.handleAccountListChange()
			},
		)
	}

	/**
	 * 处理账号列表变化
	 */
	private handleAccountListChange(): void {
		const pendingOperation = this.pendingOperation
		if (!pendingOperation) {
			return
		}

		const accounts = userStore.account.accounts
		const currentUserInfo = userStore.user.userInfo

		// 场景1：目标账号被删除
		if (pendingOperation.type === "organization") {
			const targetMagicId = pendingOperation.data.userInfo?.magic_id
			if (targetMagicId) {
				const targetAccountExists = accounts.some((acc) => acc.magic_id === targetMagicId)

				if (!targetAccountExists) {
					this.destroyOrganizationModal()
					this.clearPendingOperation()
					logger.log("账号列表变化: 目标账号已删除，关闭组织切换弹窗")
					return
				}
			}
		} else if (pendingOperation.type === "account") {
			const targetMagicId = pendingOperation.data.magicId
			if (targetMagicId) {
				const targetAccountExists = accounts.some((acc) => acc.magic_id === targetMagicId)

				if (!targetAccountExists) {
					this.destroyAccountModal()
					this.cleanupAccountReaction()
					this.clearPendingOperation()
					logger.log("账号列表变化: 目标账号已删除，关闭账号切换弹窗")
					return
				}
			}
		}

		// 场景2：当前账号被删除
		if (currentUserInfo) {
			const currentAccountExists = accounts.some(
				(acc) => acc.magic_id === currentUserInfo.magic_id,
			)

			if (!currentAccountExists) {
				this.destroyOrganizationModal()
				this.destroyAccountModal()
				this.cleanupAccountReaction()
				this.clearPendingOperation()
				logger.log("账号列表变化: 当前账号已删除，清理所有弹窗和资源")
				return
			}
		}

		// 场景3：账号列表为空
		if (accounts.length === 0) {
			this.destroyOrganizationModal()
			this.destroyAccountModal()
			this.cleanupAccountReaction()
			this.clearPendingOperation()
			logger.log("账号列表变化: 账号列表为空，清理所有弹窗和资源")
		}
	}

	/**
	 * 设置组织切换弹窗
	 */
	public setOrganizationModal(modal: ReturnType<typeof MagicModal.confirm> | null): void {
		this.organizationModal = modal
	}

	/**
	 * 获取组织切换弹窗
	 */
	public getOrganizationModal(): ReturnType<typeof MagicModal.confirm> | null {
		return this.organizationModal
	}

	/**
	 * 销毁组织切换弹窗
	 */
	public destroyOrganizationModal(): void {
		if (this.organizationModal) {
			try {
				this.organizationModal.destroy()
			} catch (error) {
				logger.error("销毁组织切换弹窗失败", error)
			}
			this.organizationModal = null
		}
	}

	/**
	 * 设置账号切换弹窗
	 */
	public setAccountModal(modal: ReturnType<typeof MagicModal.confirm> | null): void {
		this.accountModal = modal
	}

	/**
	 * 获取账号切换弹窗
	 */
	public getAccountModal(): ReturnType<typeof MagicModal.confirm> | null {
		return this.accountModal
	}

	/**
	 * 销毁账号切换弹窗
	 */
	public destroyAccountModal(): void {
		if (this.accountModal) {
			try {
				this.accountModal.destroy()
			} catch (error) {
				logger.error("销毁账号切换弹窗失败", error)
			}
			this.accountModal = null
		}
	}

	/**
	 * 设置待处理操作
	 */
	public setPendingOperation(operation: PendingSwitchOperation | null): void {
		this.pendingOperation = operation
	}

	/**
	 * 获取待处理操作
	 */
	public getPendingOperation(): PendingSwitchOperation | null {
		return this.pendingOperation
	}

	/**
	 * 更新待处理操作
	 */
	public updatePendingOperation(operation: PendingSwitchOperation): void {
		this.pendingOperation = operation
	}

	/**
	 * 清理待处理操作
	 */
	public clearPendingOperation(): void {
		this.pendingOperation = null
	}

	/**
	 * 设置账号切换 reaction 的取消函数
	 */
	public setAccountReactionCancel(cancel: (() => void) | null): void {
		this.accountReactionCancel = cancel
	}

	/**
	 * 清理账号切换 reaction
	 */
	public cleanupAccountReaction(): void {
		if (this.accountReactionCancel) {
			try {
				this.accountReactionCancel()
			} catch (error) {
				logger.error("清理账号切换 reaction 失败", error)
			}
			this.accountReactionCancel = null
		}
	}

	/**
	 * 添加事件到队列（用于去重）
	 */
	public addEventToQueue(eventId: string, operation: PendingSwitchOperation): void {
		this.eventQueue.set(eventId, operation)
	}

	/**
	 * 从队列中获取事件
	 */
	public getEventFromQueue(eventId: string): PendingSwitchOperation | undefined {
		return this.eventQueue.get(eventId)
	}

	/**
	 * 从队列中移除事件
	 */
	public removeEventFromQueue(eventId: string): void {
		this.eventQueue.delete(eventId)
	}

	/**
	 * 清理所有资源
	 */
	public cleanup(): void {
		this.destroyOrganizationModal()
		this.destroyAccountModal()
		this.cleanupAccountReaction()
		this.accountListReactionCancel?.()
		this.accountListReactionCancel = null
		this.clearPendingOperation()
	}

	/**
	 * 重置状态管理器
	 */
	public reset(): void {
		this.cleanup()
		this.eventQueue.clear()
	}
}

import type { Canvas } from "../Canvas"
import type { UserAction, UserActionCategory, UserActionOptionsMap } from "./types"

/**
 * 用户动作注册表
 * 管理所有用户可触发的动作，提供统一的执行入口
 */
export class UserActionRegistry {
	private canvas: Canvas
	private actions = new Map<string, UserAction<string, unknown>>()

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	/**
	 * 注册单个动作
	 */
	public register<TId extends string>(action: UserAction<TId>): void {
		if (this.actions.has(action.id)) {
			console.warn(`UserAction with id "${action.id}" is already registered. Overwriting.`)
		}
		this.actions.set(action.id, action as UserAction<string, unknown>)
	}

	/**
	 * 批量注册动作
	 */
	public registerAll(actions: UserAction[]): void {
		actions.forEach((action) => this.register(action))
	}

	/**
	 * 检查动作是否可执行
	 * @param id 动作ID
	 * @returns 是否可执行
	 */
	public canExecute(id: string): boolean {
		const action = this.actions.get(id)
		if (!action) {
			console.warn(`UserAction with id "${id}" not found`)
			return false
		}

		try {
			return action.canExecute(this.canvas)
		} catch (error) {
			console.error(`Error checking canExecute for action "${id}":`, error)
			return false
		}
	}

	/**
	 * 执行动作（类型安全版本）
	 * 内部会再次检查 canExecute，确保安全性
	 * @param id 动作ID
	 * @param options 可选的执行选项（根据动作ID自动推断类型）
	 */
	public async execute<TId extends keyof UserActionOptionsMap>(
		id: TId,
		options?: UserActionOptionsMap[TId],
	): Promise<void>
	public async execute(id: string, options?: unknown): Promise<void>
	public async execute(id: string, options?: unknown): Promise<void> {
		const action = this.actions.get(id)
		if (!action) {
			console.warn(`UserAction with id "${id}" not found`)
			return
		}

		// 双重检查：即使是快捷键触发，也要验证是否可执行
		if (!this.canExecute(id)) {
			// 静默返回，不执行
			return
		}

		try {
			await action.execute(this.canvas, options)
		} catch (error) {
			console.error(`Error executing action "${id}":`, error)
		}
	}

	/**
	 * 获取动作定义
	 * @param id 动作ID
	 * @returns 动作定义，如果不存在则返回 undefined
	 */
	public get(id: string): UserAction | undefined {
		return this.actions.get(id)
	}

	/**
	 * 获取所有动作
	 * @returns 所有动作的数组
	 */
	public getAll(): UserAction[] {
		return Array.from(this.actions.values())
	}

	/**
	 * 根据分类获取动作
	 * @param category 动作分类
	 * @returns 该分类下的所有动作
	 */
	public getByCategory(category: UserActionCategory): UserAction[] {
		return this.getAll().filter((action) => action.category === category)
	}

	/**
	 * 检查动作是否已注册
	 * @param id 动作ID
	 * @returns 是否已注册
	 */
	public has(id: string): boolean {
		return this.actions.has(id)
	}

	/**
	 * 获取不可执行的原因
	 * @param id 动作ID
	 * @param canvas Canvas实例
	 * @returns 不可执行的原因，如果可执行或动作不存在则返回 null
	 */
	public getDisabledReason(id: string): string | null {
		const action = this.actions.get(id)
		if (!action) {
			return null
		}

		if (action.canExecute(this.canvas)) {
			return null
		}

		if (action.getDisabledReason) {
			try {
				return action.getDisabledReason(this.canvas)
			} catch (error) {
				console.error(`Error getting disabled reason for action "${id}":`, error)
				return null
			}
		}

		return null
	}
}

import type { manageCursor } from "../utils"

// 创建一个全局实例引用，确保所有组件共享相同的光标管理
export const globalCursorManager = {
	instance: null as ReturnType<typeof manageCursor> | null,
}

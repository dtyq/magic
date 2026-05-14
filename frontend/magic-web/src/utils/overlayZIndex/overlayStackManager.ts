export type OverlayZIndexScope = "global" | "fullscreen"

export interface AcquireOverlayZIndexOptions {
	scope?: OverlayZIndexScope
	zIndex?: number
	zIndexManaged?: boolean
}

export interface OverlayZIndexEntry {
	overlayZIndex: number
	contentZIndex: number
	release: () => void
}

interface OverlayScopeState {
	nextZIndex: number
	activeCount: number
}

const OVERLAY_Z_INDEX_STEP = 10
const OVERLAY_SCOPE_BASE_Z_INDEX: Record<OverlayZIndexScope, number> = {
	global: 500,
	fullscreen: 9000,
}

const scopeStates = createInitialScopeStates()

/** 为浮层分配本轮打开期间稳定的层级，并返回可幂等释放的句柄。 */
export function acquireOverlayZIndex({
	scope = "global",
	zIndex,
	zIndexManaged = true,
}: AcquireOverlayZIndexOptions = {}): OverlayZIndexEntry {
	if (zIndexManaged === false) return createManualOverlayZIndexEntry(zIndex, scope)

	const state = scopeStates[scope]
	const requestedBase = zIndex ?? OVERLAY_SCOPE_BASE_Z_INDEX[scope]
	const overlayZIndex = Math.max(state.nextZIndex, requestedBase)
	let isReleased = false

	state.nextZIndex = overlayZIndex + OVERLAY_Z_INDEX_STEP
	state.activeCount += 1

	return {
		overlayZIndex,
		contentZIndex: overlayZIndex + 1,
		release: () => {
			if (isReleased) return

			isReleased = true
			state.activeCount = Math.max(0, state.activeCount - 1)
			if (state.activeCount === 0) resetScopeState(scope)
		},
	}
}

/** 重置全局栈状态，专供单元测试隔离各用例的层级游标。 */
export function resetOverlayStackForTest() {
	Object.assign(scopeStates, createInitialScopeStates())
}

/** 读取 scope 的默认基准层级，供 Hook 在尚未注册前返回稳定兜底值。 */
export function getOverlayScopeBaseZIndex(scope: OverlayZIndexScope = "global") {
	return OVERLAY_SCOPE_BASE_Z_INDEX[scope]
}

/** 生成固定层级结果；非托管模式不影响全局游标和 activeCount。 */
function createManualOverlayZIndexEntry(
	zIndex: number | undefined,
	scope: OverlayZIndexScope,
): OverlayZIndexEntry {
	const overlayZIndex = zIndex ?? OVERLAY_SCOPE_BASE_Z_INDEX[scope]

	return {
		overlayZIndex,
		contentZIndex: overlayZIndex + 1,
		release: () => undefined,
	}
}

/** 创建各 scope 的初始状态，保持运行时和测试重置逻辑一致。 */
function createInitialScopeStates(): Record<OverlayZIndexScope, OverlayScopeState> {
	return {
		global: createScopeState("global"),
		fullscreen: createScopeState("fullscreen"),
	}
}

/** 创建单个 scope 的初始游标，首个分配值从 base + step 开始。 */
function createScopeState(scope: OverlayZIndexScope): OverlayScopeState {
	return {
		nextZIndex: OVERLAY_SCOPE_BASE_Z_INDEX[scope] + OVERLAY_Z_INDEX_STEP,
		activeCount: 0,
	}
}

/** 在 scope 完全清空时回收本轮会话游标，避免长期会话后层级无限增长。 */
function resetScopeState(scope: OverlayZIndexScope) {
	scopeStates[scope] = createScopeState(scope)
}

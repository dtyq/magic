import { useEffect, useMemo, useRef, useState } from "react"
import type { ModelPriceSnapshot } from "./system-model-price-preview"

/** 页面内共享一次请求，延迟释放以兼容 StrictMode 的 effect 重放。 */
class PagePriceSession {
	private controller = new AbortController()
	private pending: Promise<ModelPriceSnapshot> | undefined
	private leases = 0
	/** 取得会话引用；只在真实离开页面或切换上下文后取消网络。 */
	retain() {
		this.leases += 1
	}
	/** 微任务内允许 StrictMode 重新订阅同一个页面会话。 */
	release() {
		this.leases -= 1
		queueMicrotask(() => {
			if (this.leases === 0) this.controller.abort()
		})
	}
	/** 重试显式替换失败请求；其他重渲染复用同一个 Promise。 */
	load(loader: (signal: AbortSignal) => Promise<ModelPriceSnapshot>, retry = false) {
		if (retry) {
			this.controller.abort()
			this.controller = new AbortController()
			this.pending = undefined
		}
		this.pending ??= Promise.resolve().then(() => loader(this.controller.signal))
		return this.pending
	}
}
/** 页面会话拥有请求与展开状态，两个管理端复用生命周期边界。 */
export function usePricePreviewPage(context: string, client?: object) {
	const sequence = useRef(0)
	const session = useMemo(
		() => ({
			id: ++sequence.current,
			request: new PagePriceSession(),
			expanded: new Map<string, boolean>(),
		}),
		[context, client],
	)
	const [, render] = useState(0)
	useEffect(() => {
		session.request.retain()
		return () => session.request.release()
	}, [session])
	/** 展开状态不随表单草稿变化复位。 */
	function toggle(key: string, defaultValue = false) {
		session.expanded.set(key, !(session.expanded.get(key) ?? defaultValue))
		render((value) => value + 1)
	}
	return { session, expanded: session.expanded, toggle }
}
/** 旧管理端没有查询上下文，局部状态按页面会话隔离并忽略迟到响应。 */
export function useModelPricePreview(
	context: string,
	loader: (signal: AbortSignal) => Promise<ModelPriceSnapshot>,
	client?: object,
) {
	const page = usePricePreviewPage(context, client)
	const loaderRef = useRef(loader)
	loaderRef.current = loader
	const [attempt, setAttempt] = useState(0)
	const [state, setState] = useState<{
		session: typeof page.session
		data?: ModelPriceSnapshot
		loading: boolean
		error: boolean
	}>({ session: page.session, loading: true, error: false })
	useEffect(() => {
		let active = true
		setState({ session: page.session, loading: true, error: false })
		const currentLoader = loaderRef.current
		page.session.request.load(currentLoader).then(
			(data) => {
				if (active) setState({ session: page.session, data, loading: false, error: false })
			},
			() => {
				if (active) setState({ session: page.session, loading: false, error: true })
			},
		)
		return () => {
			active = false
		}
	}, [page.session, attempt])
	const current =
		state.session === page.session ? state : { data: undefined, loading: true, error: false }
	/** 显式重试只刷新独立价格区域。 */
	function retry() {
		if (current.loading) return
		void page.session.request.load(loaderRef.current, true).catch(() => undefined)
		setAttempt((value) => value + 1)
	}
	return {
		data: current.data,
		loading: current.loading,
		error: current.error,
		retry,
		expanded: page.expanded,
		toggle: page.toggle,
	}
}
/** 两端表格仅消费快照状态与展开操作，不依赖具体请求库。 */
export interface ModelPricePreviewState {
	data?: ModelPriceSnapshot
	loading: boolean
	error: boolean
	retry: () => void
	expanded: Map<string, boolean>
	toggle: (key: string, defaultValue?: boolean) => void
}

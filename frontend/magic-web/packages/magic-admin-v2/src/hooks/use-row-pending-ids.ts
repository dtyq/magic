import { useRef, useState } from "react"

/** 创建与 React 无关的行内异步任务控制器，便于复用和行为测试。 */
export function createRowPendingController(
	onChange: (pendingIds: Set<string>) => void,
) {
	const pendingIds = new Set<string>()

	async function run<T>(id: string, task: () => Promise<T>) {
		if (pendingIds.has(id)) return undefined

		pendingIds.add(id)
		onChange(new Set(pendingIds))
		try {
			return await task()
		} finally {
			pendingIds.delete(id)
			onChange(new Set(pendingIds))
		}
	}

	return {
		getPendingIds: () => new Set(pendingIds),
		run,
	}
}

/** 管理可并发执行的行内异步操作，并将 loading 精确限制在对应行。 */
export function useRowPendingIds() {
	const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())
	const controllerRef = useRef<ReturnType<typeof createRowPendingController> | null>(null)
	if (!controllerRef.current) {
		controllerRef.current = createRowPendingController(setPendingIds)
	}

	return { pendingIds, run: controllerRef.current.run }
}

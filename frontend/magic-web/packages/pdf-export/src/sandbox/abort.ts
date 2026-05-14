export function createAbortError(): Error {
	return new DOMException("Export aborted", "AbortError")
}

export function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw createAbortError()
}

export async function withAbort<T>({
	task,
	signal,
}: {
	task: Promise<T>
	signal?: AbortSignal
}): Promise<T> {
	if (!signal) return task
	throwIfAborted(signal)
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => {
			signal.removeEventListener("abort", onAbort)
			reject(createAbortError())
		}
		signal.addEventListener("abort", onAbort, { once: true })
		task.then(
			(value) => {
				signal.removeEventListener("abort", onAbort)
				resolve(value)
			},
			(error) => {
				signal.removeEventListener("abort", onAbort)
				reject(error)
			},
		)
	})
}

export async function runCancelableSteps({
	signal,
	steps,
}: {
	signal?: AbortSignal
	steps: Array<() => void | Promise<void>>
}): Promise<void> {
	for (const step of steps) {
		throwIfAborted(signal)
		await withAbort({
			task: Promise.resolve(step()),
			signal,
		})
	}
	throwIfAborted(signal)
}

export function waitForTimeout({
	ms,
	signal,
}: {
	ms: number
	signal?: AbortSignal
}): Promise<void> {
	throwIfAborted(signal)
	return new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			if (signal) signal.removeEventListener("abort", onAbort)
		}
		const timer = setTimeout(() => {
			cleanup()
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			cleanup()
			reject(createAbortError())
		}
		signal?.addEventListener("abort", onAbort, { once: true })
	})
}

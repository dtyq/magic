import { useCallback, useRef, useState } from "react"

export type PendingGuardAction = () => void | Promise<void>

interface PendingAction<TContext> {
	action: PendingGuardAction
	context: TContext
	resolve: (allowed: boolean) => void
}

export interface UsePendingActionGuardOptions<TContext> {
	/** Return true when the current state must be confirmed before continuing. */
	shouldBlock: () => boolean
	/** Open the caller-owned dialog after an action has been deferred. */
	onBlocked?: (context: TContext) => void
}

export interface UsePendingActionGuardResult<TContext> {
	/** Run immediately when allowed, or defer until resolve/cancel is called. */
	run: (action: PendingGuardAction, context: TContext) => Promise<boolean>
	/** Resolve the currently deferred action and run it when allowed. */
	resolve: (allowed: boolean) => Promise<boolean>
	/** Cancel and resolve the currently deferred action with false. */
	cancel: () => void
	/** Context attached to the currently deferred action, if any. */
	pendingContext: TContext | null
	/** Whether an action is waiting for the caller-owned dialog. */
	isPending: boolean
}

/**
 * Keeps the deferred action and its Promise in one place so navigation and
 * refresh flows do not each maintain their own pending-action refs.
 */
export function usePendingActionGuard<TContext = undefined>(
	options: UsePendingActionGuardOptions<TContext>,
): UsePendingActionGuardResult<TContext> {
	const { shouldBlock, onBlocked } = options
	const optionsRef = useRef({ shouldBlock, onBlocked })
	optionsRef.current = { shouldBlock, onBlocked }
	const pendingRef = useRef<PendingAction<TContext> | null>(null)
	const busyRef = useRef(false)
	const [pendingContext, setPendingContext] = useState<TContext | null>(null)
	const [isPending, setIsPending] = useState(false)

	const run = useCallback(
		async (action: PendingGuardAction, context: TContext): Promise<boolean> => {
			// A visible confirmation owns the next action. Ignore later clicks rather
			// than replacing the action the user is currently deciding about.
			if (busyRef.current) return false
			busyRef.current = true

			try {
				if (!optionsRef.current.shouldBlock()) {
					await action()
					busyRef.current = false
					return true
				}

				return await new Promise<boolean>((resolve) => {
					pendingRef.current = { action, context, resolve }
					setPendingContext(context)
					setIsPending(true)
					optionsRef.current.onBlocked?.(context)
				})
			} catch (error) {
				busyRef.current = false
				throw error
			}
		},
		[],
	)

	const resolve = useCallback(async (allowed: boolean): Promise<boolean> => {
		const pending = pendingRef.current
		if (!pending) return false

		pendingRef.current = null
		setPendingContext(null)
		setIsPending(false)
		busyRef.current = false

		if (!allowed) {
			pending.resolve(false)
			return false
		}

		try {
			await pending.action()
			pending.resolve(true)
			return true
		} catch (error) {
			pending.resolve(false)
			throw error
		}
	}, [])

	const cancel = useCallback(() => {
		void resolve(false)
	}, [resolve])

	return { run, resolve, cancel, pendingContext, isPending }
}

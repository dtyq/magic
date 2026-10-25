import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Shared lifecycle state for rename operations.
 *
 * File renames are intentionally sequential, so stopping means preventing the
 * next request while allowing the current request to settle safely.
 */
export function useRenameOperationState() {
	const [saving, setSaving] = useState(false)
	const [error, setErrorState] = useState("")
	const mountedRef = useRef(true)
	const savingRef = useRef(false)
	const stopRequestedRef = useRef(false)

	useEffect(() => {
		return () => {
			mountedRef.current = false
			stopRequestedRef.current = true
		}
	}, [])

	const setError = useCallback((message: string) => {
		if (mountedRef.current) setErrorState(message)
	}, [])

	const clearError = useCallback(() => {
		if (mountedRef.current) setErrorState("")
	}, [])

	const begin = useCallback(() => {
		if (!mountedRef.current || savingRef.current) return false
		savingRef.current = true
		stopRequestedRef.current = false
		setSaving(true)
		setErrorState("")
		return true
	}, [])

	const finish = useCallback(() => {
		savingRef.current = false
		if (mountedRef.current) setSaving(false)
	}, [])

	const isSaving = useCallback(() => savingRef.current, [])
	const requestStop = useCallback(() => {
		stopRequestedRef.current = true
	}, [])
	const shouldStop = useCallback(() => stopRequestedRef.current, [])

	return {
		saving,
		error,
		savingRef,
		begin,
		finish,
		isSaving,
		requestStop,
		shouldStop,
		setError,
		clearError,
	}
}

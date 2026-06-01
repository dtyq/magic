import { useEffect, useRef, useState } from "react"

const STREAMING_COMMIT_INTERVAL = 120

export function useStreamingCommittedContent(content: string, loading?: boolean) {
	const [committedContent, setCommittedContent] = useState(content)
	const lastCommitTimeRef = useRef(0)
	const timerRef = useRef<number>(0)

	useEffect(() => {
		window.clearTimeout(timerRef.current)

		if (!loading) {
			lastCommitTimeRef.current = Date.now()
			setCommittedContent(content)
			return undefined
		}

		const now = Date.now()
		const remaining = STREAMING_COMMIT_INTERVAL - (now - lastCommitTimeRef.current)

		if (remaining <= 0) {
			lastCommitTimeRef.current = now
			setCommittedContent(content)
			return undefined
		}

		timerRef.current = window.setTimeout(() => {
			lastCommitTimeRef.current = Date.now()
			setCommittedContent(content)
		}, remaining)

		return () => window.clearTimeout(timerRef.current)
	}, [content, loading])

	useEffect(
		() => () => {
			window.clearTimeout(timerRef.current)
		},
		[],
	)

	return committedContent
}

import { useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import { Typewriter } from "./TypeWriter"

const useStyles = createStyles(({ css }) => {
	return {
		typing: css`
			white-space: nowrap;
			border-right: 2px solid transparent;
			line-height: 10px;
			animation: typing 3s steps(15, end), blink-caret 0.5s step-end infinite;
			overflow: hidden;
		`,
	}
})

export function useTyping(init: string = "") {
	const [content, setContent] = useState(init)

	const { styles } = useStyles()

	const writer = useRef(new Typewriter((str) => setContent((last) => last + str)))

	const cursor = writer.current.consuming ? <span className={styles.typing} /> : null

	return {
		add: useMemoizedFn(writer.current.add.bind(writer.current)),
		start: useMemoizedFn(writer.current.start.bind(writer.current)),
		stop: useMemoizedFn(writer.current.stop.bind(writer.current)),
		resume: useMemoizedFn(writer.current.resume.bind(writer.current)),
		done: useMemoizedFn(writer.current.done.bind(writer.current)),
		typing: writer.current.consuming,
		cursor,
		content,
	}
}

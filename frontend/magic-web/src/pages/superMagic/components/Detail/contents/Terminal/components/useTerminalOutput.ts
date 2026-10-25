import { useCallback, useEffect, useRef, useState } from "react"
import { Terminal, type ITheme } from "@xterm/xterm"
import { readTerminalDocument, type TerminalDocument } from "./terminal-buffer"

interface TerminalOutputOptions {
	content: string
	recordKey: string
	theme: ITheme
}

const EMPTY_DOCUMENT: TerminalDocument = { text: "", styles: [] }

export function useTerminalOutput(options: TerminalOutputOptions) {
	const optionsRef = useRef(options)
	optionsRef.current = options
	const terminalRef = useRef<Terminal | null>(null)
	const writtenRef = useRef<string | null>(null)
	const writingRef = useRef(false)
	const [document, setDocument] = useState({
		recordKey: options.recordKey,
		value: EMPTY_DOCUMENT,
	})
	const [failed, setFailed] = useState(false)

	const writeLatest = useCallback(function writeLatestContent() {
		const terminal = terminalRef.current
		if (!terminal || writingRef.current) return
		const { content, recordKey } = optionsRef.current
		const previous = writtenRef.current
		if (previous === content) return
		const append = previous !== null && content.startsWith(previous)
		try {
			// 容量由已收到的内容决定，不扩大后台采集范围；原始字符串仍是完整来源。
			// 固定终端列宽解析后再交给编辑器排版，长行不会扩大其它行的缓存。
			terminal.options.scrollback = Math.max(terminal.options.scrollback ?? 0, content.length)
			if (!append) terminal.reset()
			writingRef.current = true
			terminal.write(append ? content.slice(previous.length) : content, () => {
				if (terminalRef.current !== terminal) return
				writtenRef.current = content
				writingRef.current = false
				setDocument({
					recordKey,
					value: readTerminalDocument(terminal, optionsRef.current.theme),
				})
				// write 异步解析期间只保留最新快照，不让 reset 与旧写入交错。
				writeLatestContent()
			})
		} catch (error) {
			writingRef.current = false
			setFailed(true)
			console.warn("Failed to parse terminal output:", error)
		}
	}, [])

	useEffect(() => {
		// 无需 open 或挂载隐藏终端；这里只使用 xterm 的解析器与公开缓冲 API。
		const terminal = new Terminal({ allowProposedApi: true, convertEol: true })
		terminalRef.current = terminal
		writtenRef.current = null
		writingRef.current = false
		setFailed(false)
		writeLatest()
		return () => {
			terminalRef.current = null
			terminal.dispose()
		}
	}, [options.recordKey, writeLatest])

	useEffect(() => writeLatest(), [options.content, writeLatest])
	useEffect(() => {
		const terminal = terminalRef.current
		if (terminal && !writingRef.current && writtenRef.current !== null) {
			setDocument({
				recordKey: options.recordKey,
				value: readTerminalDocument(terminal, options.theme),
			})
		}
	}, [options.theme, options.recordKey])

	return {
		document: document.recordKey === options.recordKey ? document.value : EMPTY_DOCUMENT,
		failed,
	}
}

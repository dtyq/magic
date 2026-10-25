import { useLayoutEffect, useRef, type KeyboardEventHandler, type RefObject } from "react"
import { Textarea } from "../../primitives/shadcn/textarea"

interface RenameNameFieldProps {
	value: string
	onChange: (value: string) => void
	label: string
	id?: string
	inputRef?: RefObject<HTMLTextAreaElement>
	extension?: string
	maxRows?: number
	disabled?: boolean
	invalid?: boolean
	onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
}

/** 标题与文件名共用排版；始终挂载输入，不因出现原名对照而丢失光标。 */
export default function RenameNameField({
	value,
	onChange,
	label,
	id,
	inputRef,
	extension,
	maxRows,
	disabled,
	invalid,
	onKeyDown,
}: RenameNameFieldProps) {
	const localInputRef = useRef<HTMLTextAreaElement>(null)
	const input = inputRef ?? localInputRef
	const beforeFocus = useRef(value)
	useLayoutEffect(() => {
		const node = input.current
		if (!node) return
		// 不依赖 field-sizing 的浏览器支持；长文本按可用宽度增高，必要时由 maxRows 限制在输入框内滚动。
		node.style.height = "0px"
		node.style.height = `${node.scrollHeight}px`
	}, [input, value])
	useLayoutEffect(() => {
		const node = input.current
		if (!node) return
		let width = node.clientWidth
		const observer = new ResizeObserver(() => {
			if (node.clientWidth === width) return
			width = node.clientWidth
			node.style.height = "0px"
			node.style.height = `${node.scrollHeight}px`
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [input])
	return (
		<div className="flex min-w-0 items-start gap-2 text-sm leading-5">
			<Textarea
				ref={input}
				id={id}
				rows={1}
				value={value}
				aria-label={label}
				aria-invalid={invalid}
				disabled={disabled}
				className="min-h-5 min-w-0 flex-1 resize-none overflow-hidden break-all rounded-none border-0 p-0 text-sm leading-5 shadow-none [overflow-wrap:anywhere] focus-visible:ring-0 focus-visible:ring-offset-0"
				style={
					maxRows
						? {
								maxHeight: `${maxRows * 20}px`,
								overflowY: "auto",
							}
						: undefined
				}
				onFocus={() => {
					beforeFocus.current = value
				}}
				onChange={(event) => onChange(event.target.value.replace(/[\r\n]/g, ""))}
				onKeyDown={(event) => {
					if (onKeyDown) {
						onKeyDown(event)
						return
					}
					if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
					if (event.key === "Enter") {
						event.preventDefault()
						event.currentTarget.blur()
					}
					if (event.key === "Escape") {
						event.preventDefault()
						event.stopPropagation()
						onChange(beforeFocus.current)
						event.currentTarget.blur()
					}
				}}
			/>
			{extension && (
				<span className="shrink-0 whitespace-nowrap text-sm leading-5 text-muted-foreground">
					{extension}
				</span>
			)}
		</div>
	)
}

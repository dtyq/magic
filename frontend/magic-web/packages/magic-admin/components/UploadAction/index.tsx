import { useMemoizedFn } from "ahooks"
import type { ChangeEventHandler, HTMLAttributes, ReactNode } from "react"
import { useEffect, useRef } from "react"

export interface UploadActionProps extends HTMLAttributes<HTMLInputElement> {
	multiple?: boolean
	accept?: string
	directory?: boolean
	handler: (onUpload: () => void) => ReactNode
	onFileChange?: (File: FileList) => void
}

const UploadAction = ({
	handler,
	onFileChange,
	multiple = false,
	directory = false,
	...props
}: UploadActionProps) => {
	const uploadRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const input = uploadRef.current
		if (!input) return

		if (directory) {
			input.setAttribute("webkitdirectory", "")
			input.setAttribute("directory", "")
		} else {
			input.removeAttribute("webkitdirectory")
			input.removeAttribute("directory")
		}
	}, [directory])

	const handleUpload = useMemoizedFn(() => {
		uploadRef.current?.click()
	})

	const handleFileChange = useMemoizedFn<ChangeEventHandler<HTMLInputElement>>((ev) => {
		const { files } = ev.target
		if (files) {
			onFileChange?.(files)
			ev.target.value = ""
		}
	})

	return (
		<>
			{handler(handleUpload)}
			<input
				type="file"
				multiple={directory || multiple}
				ref={uploadRef}
				style={{ display: "none" }}
				onChange={handleFileChange}
				{...props}
			/>
		</>
	)
}

export default UploadAction

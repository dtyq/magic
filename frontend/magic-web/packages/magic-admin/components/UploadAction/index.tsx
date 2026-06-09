import { useMemoizedFn } from "ahooks"
import type { ChangeEventHandler, HTMLAttributes, ReactNode } from "react"
import { useRef } from "react"

export interface UploadActionProps extends HTMLAttributes<HTMLInputElement> {
	multiple?: boolean
	accept?: string
	handler: (onUpload: () => void) => ReactNode
	onFileChange?: (File: FileList) => void
}

const UploadAction = ({ handler, onFileChange, multiple = false, ...props }: UploadActionProps) => {
	const uploadRef = useRef<HTMLInputElement>(null)

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
				multiple={multiple}
				ref={uploadRef}
				style={{ display: "none" }}
				onChange={handleFileChange}
				{...props}
			/>
		</>
	)
}

export default UploadAction

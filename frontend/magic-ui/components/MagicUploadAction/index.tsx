import { useMemoizedFn } from "ahooks"
import type { ChangeEventHandler, HTMLAttributes, ReactNode } from "react"
import { memo, useRef } from "react"

export interface MagicUploadActionProps extends HTMLAttributes<HTMLInputElement> {
	multiple?: boolean
	handler: (onUpload: () => void) => ReactNode
	onFileChange?: (File: FileList) => void
}

function MagicUploadAction({
	handler,
	onFileChange,
	multiple = false,
	...props
}: MagicUploadActionProps) {
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
				onInput={handleFileChange}
				{...props}
			/>
		</>
	)
}

export default memo(MagicUploadAction)

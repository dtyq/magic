import { IconFileUpload } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { memo } from "react"
import type { MagicButtonProps } from "../MagicButton"
import MagicButton from "../MagicButton"
import UploadAction from "../UploadAction"

export const enum IMStyle {
	Modern = "modern",
	Standard = "standard",
}

export interface UploadButtonProps extends MagicButtonProps {
	loading?: boolean
	icon?: React.ReactNode
	imStyle?: IMStyle
	onFileChange?: (files: FileList) => void
	multiple?: boolean
	accept?: string
}

const UploadButton = memo(
	({ icon, onFileChange, multiple = true, children, accept, ...props }: UploadButtonProps) => {
		const UploadHandler = useMemoizedFn((onUpload) => {
			return (
				<MagicButton
					type="text"
					onClick={onUpload}
					icon={icon || <IconFileUpload color="currentColor" size={20} />}
					{...props}
				>
					{children}
				</MagicButton>
			)
		})

		return (
			<UploadAction
				handler={UploadHandler}
				onFileChange={onFileChange}
				multiple={multiple}
				accept={accept}
			/>
		)
	},
)

export default UploadButton

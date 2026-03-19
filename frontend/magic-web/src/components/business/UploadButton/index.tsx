import type { MagicButtonProps } from "@/components/base/MagicButton"
import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import UploadAction from "@/components/base/UploadAction"
import type { IMStyle } from "@/providers/AppearanceProvider/context"
import { IconFileUpload } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { memo } from "react"

interface UploadButtonProps extends MagicButtonProps {
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
					icon={
						icon || (
							<MagicIcon color="currentColor" size={20} component={IconFileUpload} />
						)
					}
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

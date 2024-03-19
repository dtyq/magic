import UploadAction from "@/opensource/components/base/UploadAction"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"
import { IconCloudUpload, IconLoader2 } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import type { MouseEventHandler } from "react"
import { useTranslation } from "react-i18next"

interface UploadButtonProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
	icon?: React.ReactNode
	text?: string
	loading?: boolean
	onFileChange?: (files: FileList) => void
}

function UploadButton({
	icon,
	text,
	onFileChange,
	loading,
	className,
	disabled,
	onClick,
	...props
}: UploadButtonProps) {
	const { t } = useTranslation("interface")

	const UploadHandler = useMemoizedFn((onUpload) => {
		const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
			onUpload()
			onClick?.(event)
		}

		return (
			<Button
				type="button"
				variant="outline"
				className={cn(
					"flex h-8 w-[90px] items-center justify-center gap-2.5 rounded-[20px] border-border",
					className,
				)}
				disabled={disabled || loading}
				onClick={handleClick}
				{...props}
			>
				{loading ? (
					<IconLoader2 size={20} className="animate-spin" />
				) : (
					(icon ?? <IconCloudUpload size={20} />)
				)}
				{text || t("agent.upload")}
			</Button>
		)
	})

	return <UploadAction multiple={false} handler={UploadHandler} onFileChange={onFileChange} />
}

export default UploadButton

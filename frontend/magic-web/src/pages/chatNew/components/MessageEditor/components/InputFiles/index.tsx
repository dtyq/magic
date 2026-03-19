import { useControllableValue, useMemoizedFn } from "ahooks"
import { Flex, FlexProps } from "antd"
import { createStyles } from "antd-style"
import type { FileData } from "./types"
import { FileItem } from "./FileItem"

export interface InputFilesProps extends Omit<FlexProps, "children"> {
	files?: FileData[]
	onFilesChange?: (files: FileData[]) => void
}

const useStyles = createStyles(({ css }) => ({
	root: css`
		max-height: 82px;
		overflow-y: auto;
		margin-right: -15px;
	`,
}))

function InputFiles({ files, onFilesChange, className, ...rest }: InputFilesProps) {
	const { styles, cx } = useStyles()

	const [controllableFiles, onControllableFilesChange] = useControllableValue<FileData[]>(
		{ files, onFilesChange },
		{
			valuePropName: "files",
			trigger: "onFilesChange",
		},
	)

	const handleRemoveFile = useMemoizedFn((f: FileData) => {
		f.cancel?.()
		onControllableFilesChange?.(controllableFiles?.filter((file) => file.id !== f.id))
	})

	if (!controllableFiles || controllableFiles.length === 0) return null

	return (
		<Flex wrap="wrap" gap={4} className={cx(styles.root, className)} {...rest}>
			{controllableFiles?.map((file) => {
				return <FileItem data={file} key={file.id} onRemove={handleRemoveFile} />
			})}
		</Flex>
	)
}

export default InputFiles

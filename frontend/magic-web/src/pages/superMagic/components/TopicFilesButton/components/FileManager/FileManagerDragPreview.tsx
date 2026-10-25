import { forwardRef } from "react"
import { FileResourceIcon } from "../FileResourceIcon"
import type { FilePresentation } from "../../utils/file-presentation"

/** 只渲染最终集合的前三个真实图标。原生拖影负责跟随指针，源节点始终位于屏幕外。 */
export const FileManagerDragPreview = forwardRef<
	HTMLDivElement,
	{ files: FilePresentation[]; count: number }
>(function FileManagerDragPreview({ files, count }, ref) {
	return (
		<div
			ref={ref}
			aria-hidden
			className="pointer-events-none fixed -left-[10000px] top-0 h-[76px] w-[88px] select-none text-foreground"
		>
			{files.map((file, position) => (
				<div
					key={file.item.file_id}
					className="absolute flex size-12 items-center justify-center rounded-lg border bg-background shadow-sm"
					style={{
						left: position * 10,
						top: position * 8,
						zIndex: files.length - position,
					}}
				>
					<FileResourceIcon presentation={file} size={36} />
				</div>
			))}
			<span className="absolute bottom-1 right-1 z-10 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-xs font-medium text-primary-foreground">
				{count}
			</span>
		</div>
	)
})

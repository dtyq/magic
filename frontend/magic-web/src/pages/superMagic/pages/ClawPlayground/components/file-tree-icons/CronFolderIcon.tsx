import folderCronBottom from "../../assets/file-tree-icons/folder-cron-bottom.svg"
import folderCronClock from "../../assets/file-tree-icons/folder-cron-clock.svg"
import folderCronTop from "../../assets/file-tree-icons/folder-cron-top.svg"
import { CompositeFolderIcon } from "./FileTreeIconPrimitives"

export function CronFolderIcon() {
	return (
		<CompositeFolderIcon
			bottomSrc={folderCronBottom}
			glyphSrc={folderCronClock}
			glyphWrapperClassName="inset-[18.73%_16.19%_8.76%_7.86%]"
			glyphClassName="h-[10px] w-[10.667px] rotate-[-9.36deg]"
			name="cron"
			topSrc={folderCronTop}
			topWrapperClassName="inset-[4.17%_6.25%_4.17%_0]"
		/>
	)
}

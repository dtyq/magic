import { memo, type ReactNode } from "react"
import MagicDropdown from "@/components/base/MagicDropdown"
import useFileMenuItems from "./hooks/useFileMenuItems"
import { type PresetFileType } from "../constant"
import { useMemoizedFn } from "ahooks"

interface FileMenuDropdownProps {
	onAddFile?: (type: PresetFileType) => void
	onAddDesign?: () => void
	children: ReactNode
}

/**
 * File menu dropdown component
 * Displays file operation menu (create/upload) with custom trigger
 */
function FileMenuDropdown({
	onAddFile: onAddFileProp,
	onAddDesign: onAddDesignProp,
	children,
}: FileMenuDropdownProps) {
	/**
	 * 避免点击菜单项后焦点被转移到菜单项上
	 * 通过 setTimeout 延迟执行 onAddFile 回调，100ms 的延迟时间足够让菜单完全关闭
	 */
	const onAddFile = useMemoizedFn((type: PresetFileType) => {
		setTimeout(() => {
			onAddFileProp?.(type)
		}, 100)
	})

	const onAddDesign = useMemoizedFn(() => {
		setTimeout(() => {
			onAddDesignProp?.()
		}, 100)
	})

	const fileMenuItems = useFileMenuItems({ onAddFile, onAddDesign })

	return (
		<MagicDropdown menu={{ items: fileMenuItems }} trigger={["click"]} placement="bottomLeft">
			{children}
		</MagicDropdown>
	)
}

export default memo(FileMenuDropdown)

import { getPxWidth } from "@/MagicFlow/utils"
import { KEY_CODE_MAP } from "@/MagicJsonSchemaEditor/constants"
import { useUpdateEffect } from "ahooks"
import { useCallback, useMemo, useState } from "react"

type UseTextEditableEditProps = {
	/** 默认title */
	title: string
	/** 变更函数 */
	onChange?: (value: string) => void
}

export default function useTextEditableEdit({ title = "", onChange }: UseTextEditableEditProps) {
	const [isEdit, setIsEdit] = useState(false)
	// 实际title以已经设置得为准，没设置则显示默认title
	const [currentTitle, setCurrentTitle] = useState(title || "")
	/** Input框的值，默认等于当前的实际标题 */
	const [inputTitle, setInputTitle] = useState(currentTitle || "")

	useUpdateEffect(() => {
		setCurrentTitle(title || "")
		setInputTitle(title || "")
	}, [title])

	const handleKeyDown = useCallback(
		(e: any) => {
			/** 处理回车事件 */
			if ([KEY_CODE_MAP.ENTER].includes(e.keyCode)) {
				// console.log("确认", e.target.value)
				setCurrentTitle(e.target.value)
				setIsEdit(false)
				if (onChange) onChange(e.target.value)
			}
		},
		[onChange],
	)

	/** 处理输入框的Blur事件 */
	const onInputBlur = useCallback(
		(e: any) => {
			setCurrentTitle(e.target.value)
			setIsEdit(false)
			if (onChange) onChange(e.target.value)
		},
		[onChange],
	)

	const titleToolTips = useMemo(() => {
		if (!currentTitle) return ""
		return getPxWidth(currentTitle) > 100 ? currentTitle : ""
	}, [currentTitle])

	return {
		inputTitle,
		setInputTitle,
		isEdit,
		currentTitle,
		setIsEdit,
		handleKeyDown,
		onInputBlur,
		titleToolTips,
	}
}

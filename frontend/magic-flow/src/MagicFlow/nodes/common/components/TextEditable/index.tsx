import { Input, Tooltip } from "antd"
import clsx from "clsx"
import i18next from "i18next"
import React, { memo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import useTextEditable from "./hooks/useTextEditable"
import styles from "./index.module.less"

type TextEditableProps = {
	isEdit: boolean
	setIsEdit: React.Dispatch<React.SetStateAction<boolean>>
	title: string
	placeholder?: string
	onChange?: (val: string) => void
	className?: string
}

// 使用memo包装组件，避免不必要的重渲染
const TextEditable = memo(
	function TextEditable({
		isEdit,
		title,
		placeholder,
		onChange,
		setIsEdit,
		className,
	}: TextEditableProps) {
		const { t } = useTranslation()
		// 使用自定义hook处理文本编辑逻辑
		const { handleKeyDown, currentTitle, inputTitle, setInputTitle, onInputBlur } =
			useTextEditable({ title, onChange })

		// 优化文本输入处理函数
		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				setInputTitle(e.target.value)
			},
			[setInputTitle],
		)

		// 优化编辑模式切换
		const enableEditMode = useCallback(() => {
			setIsEdit(true)
		}, [setIsEdit])

		// 根据编辑状态渲染不同内容
		return (
			<div className={clsx(styles.titleEdit, className)}>
				{!isEdit ? (
					<div className={styles.titleView}>
						<Tooltip title={i18next.t("flow.click2ModifyName", { ns: "magicFlow" })}>
							<span className={styles.title} onClick={enableEditMode}>
								{currentTitle}
							</span>
						</Tooltip>
					</div>
				) : (
					<Input
						placeholder={placeholder}
						onKeyDown={handleKeyDown}
						value={inputTitle}
						onChange={handleInputChange}
						onBlur={onInputBlur}
						autoFocus
					/>
				)}
			</div>
		)
	},
	(prevProps, nextProps) => {
		// 自定义比较函数，只在重要属性变化时重新渲染
		return (
			prevProps.isEdit === nextProps.isEdit &&
			prevProps.title === nextProps.title &&
			prevProps.placeholder === nextProps.placeholder &&
			prevProps.className === nextProps.className
		)
	},
)

export default TextEditable

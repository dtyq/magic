import { prefix } from "@/MagicFlow/constants"
import { useExternal } from "@/MagicFlow/context/ExternalContext/useExternal"
import { getPxWidth } from "@/MagicFlow/utils"
import { KEY_CODE_MAP } from "@/MagicJsonSchemaEditor/constants"
import TsInput from "@/common/BaseUI/Input"
import { Tooltip } from "antd"
import { IconPencil } from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import clsx from "clsx"
import i18next from "i18next"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"

type TextEditableProps = {
	title: string
	onChange: (value: string) => void
}

export default function TextEditable({ title, onChange }: TextEditableProps) {
	const { t } = useTranslation()
	const [isEdit, setIsEdit] = useState(false)

	// 实际title以已经设置得为准，没设置则显示默认title
	const [currentTitle, setCurrentTitle] = useState(title)

	/** Input框的值，默认等于当前的实际标题 */
	const [inputTitle, setInputTitle] = useState(currentTitle || "")

	const { header } = useExternal()

	const handleKeyDown = useMemoizedFn((e) => {
		/** 处理回车事件 */
		if ([KEY_CODE_MAP.ENTER].includes(e.keyCode)) {
			// console.log("确认", e.target.value)
			setCurrentTitle(e.target.value)
			setIsEdit(false)
			if (onChange) onChange(e.target.value)
		}
	})

	/** 处理输入框的Blur事件 */
	const onInputBlur = useMemoizedFn((e) => {
		setCurrentTitle(e.target.value)
		setIsEdit(false)
		if (onChange) onChange(e.target.value)
	})

	const titleToolTips = useMemo(() => {
		return getPxWidth(currentTitle) > 300 ? currentTitle : ""
	}, [currentTitle])

	useUpdateEffect(() => {
		setInputTitle(title)
	}, [title])

	const onEdit = useMemoizedFn(() => {
		if (header?.editEvent) {
			header?.editEvent?.()
			return
		}
		setIsEdit(true)
	})

	return (
		<div className={clsx(styles.textEditable, `${prefix}text-editable`)}>
			{!isEdit && (
				<>
					<Tooltip title={titleToolTips}>
						<span className={clsx(styles.text, `${prefix}text`)}>{title}</span>
					</Tooltip>
					<IconPencil
						className={clsx(styles.editIcon, `${prefix}edit-icon`)}
						onClick={onEdit}
						size={18}
					/>
				</>
			)}
			{isEdit && (
				<TsInput
					placeholder={i18next.t("flow.pleaseInputFlowName", { ns: "magicFlow" })}
					onKeyDown={handleKeyDown}
					value={inputTitle}
					onChange={(e: any) => setInputTitle(e.target.value)}
					onBlur={onInputBlur}
					autoFocus
				/>
			)}
		</div>
	)
}

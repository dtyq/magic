import { copyToClipboard } from "@/MagicFlow/utils"
import { SchemaValueSplitor, getFormTypeToTitle } from "@/MagicJsonSchemaEditor/constants"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import { Tooltip, message } from "antd"
import { IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import React, { useMemo } from "react"
import styles from "../style/index.module.less"

type BaseItemProps = {
	field: Schema
	// 菜单显示的key
	displayKey: string
	// dropdown图标点击事件
	onExpand?: () => void
	// 是否展开
	isDisplay?: boolean
}

export default function BaseItem({ displayKey, field, onExpand, isDisplay }: BaseItemProps) {
	const formType = useMemo(() => {
		const formTypeToTitle = getFormTypeToTitle()
		if (!field?.items) return formTypeToTitle[field.type!]
		const fieldName = `${field?.type}${SchemaValueSplitor}${field?.items?.type}`
		return formTypeToTitle[fieldName]
	}, [field])

	const hasChildren = useMemo(() => {
		const itemsLength = Object.keys(field?.items || {}).length
		const propertiesLength = Object.keys(field?.properties || {}).length
		return itemsLength > 0 || propertiesLength > 0
	}, [field])

	const copyFieldKey = useMemoizedFn(() => {
		copyToClipboard(displayKey)
		message.success(i18next.t("common.copySuccess", { ns: "magicFlow" }))
	})

	const Icon = useMemo(() => {
		return isDisplay ? IconCaretDownFilled : IconCaretRightFilled
	}, [isDisplay])

	return (
		<Tooltip title={field.description}>
			<div className={styles.keyItem} onClick={copyFieldKey}>
				{hasChildren && (
					<Icon
						className={styles.dropdown}
						onClick={(e) => {
							e.stopPropagation()
							onExpand && onExpand()
						}}
					/>
				)}
				{/* @ts-ignore */}
				<span className={styles.title}>{field.title}</span>
				<span className={styles.key}>{displayKey}</span>
				<span className={styles.type}>{formType}</span>
			</div>
		</Tooltip>
	)
}

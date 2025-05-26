import { copyToClipboard } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import {
	SchemaValueSplitor,
	getFormTypeToTitle,
} from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { Tooltip, message } from "antd"
import { IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import React, { useMemo } from "react"
import { useStyles } from "../style/style"
import { getCurrentLang } from "@/utils/locale"
import { configStore } from "@/opensource/models/config"

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
	const { styles } = useStyles()

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

	const internationalTitle = useMemo(() => {
		const lang = getCurrentLang(configStore.i18n.language)
		if (lang === "zh_CN") {
			return field.title
		}
		return displayKey
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ")
	}, [displayKey, field])

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
				<span className={styles.title}>{internationalTitle}</span>
				<span className={styles.key}>{displayKey}</span>
				<span className={styles.type}>{formType}</span>
			</div>
		</Tooltip>
	)
}

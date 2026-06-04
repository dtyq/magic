import { IconWorld } from "@tabler/icons-react"
import { Form, Input, Popover } from "antd"
import { memo, useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { PopoverProps } from "antd/lib"
import { LanguageType as LangType, useAdminComponents } from "../AdminComponentsProvider"
import type { MagicButtonProps } from "../MagicButton"
import MagicButton from "../MagicButton"
import ButtonGroup from "../ButtonGroup"
import type { Lang } from "./types"
import { useStyles } from "./style"

export interface MultiLangSettingProps extends MagicButtonProps {
	className?: string
	style?: React.CSSProperties
	/** 信息 */
	info?: Lang
	/* 是否必填 */
	required?: boolean
	/* 支持的语言 */
	supportLangs?: LangType[]
	/* 支持的文本框类型 */
	supportType?: "input" | "textarea"
	/** 保存 */
	onSave?: (value: Lang) => void
	/** 弹出框 props */
	popoverProps?: PopoverProps
	/** 是否禁用 */
	disabled?: boolean
}

const MultiLangSetting = memo(
	({
		onSave,
		info,
		className,
		style,
		type,
		required,
		supportLangs = [LangType.en_US, LangType.ms_MY, LangType.vi_VN, LangType.th_TH],
		supportType = "input",
		danger,
		popoverProps,
		disabled,
		...props
	}: MultiLangSettingProps) => {
		const { styles, cx } = useStyles()

		const { getLocale } = useAdminComponents()
		const locale = getLocale("MultiLangSetting")

		const [open, setOpen] = useState(false)

		const [form] = Form.useForm()

		const onCancel = useMemoizedFn(() => {
			setOpen(false)
		})

		const onInnerSave = useMemoizedFn(async () => {
			const values = await form.validateFields()
			onSave?.(values)
			setOpen(false)
			form.resetFields()
		})

		useEffect(() => {
			if (info) {
				form.setFieldsValue({ ...info })
			}
		}, [info, form])

		const content = useMemo(() => {
			return (
				<Form form={form} className={styles.form} layout="vertical" disabled={disabled}>
					{supportLangs.map((lang) => {
						return (
							<Form.Item
								key={lang}
								className={styles.formItem}
								name={lang}
								label={locale[lang as keyof typeof locale]}
								required={required}
								rules={[{ required, message: "" }]}
							>
								{supportType === "input" ? (
									<Input
										placeholder={locale.pleaseInput}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault()
												e.stopPropagation()
											}
										}}
									/>
								) : (
									<Input.TextArea rows={4} placeholder={locale.pleaseInput} />
								)}
							</Form.Item>
						)
					})}
					<ButtonGroup onCancel={onCancel} onSave={onInnerSave} />
				</Form>
			)
		}, [
			form,
			styles.form,
			styles.formItem,
			supportLangs,
			onCancel,
			onInnerSave,
			locale,
			required,
			supportType,
			disabled,
		])

		return (
			<Popover
				className={styles.popover}
				open={open}
				title={locale.languageSetting}
				placement="bottom"
				content={content}
				onOpenChange={(visible) => {
					if (!visible) {
						setOpen(false)
					}
				}}
				{...popoverProps}
			>
				<MagicButton
					className={cx(
						type === "text" ? styles.textIcon : styles.icon,
						danger && styles.errorIcon,
						className,
					)}
					style={style}
					icon={<IconWorld size={20} />}
					onClick={() => setOpen(true)}
					{...props}
				/>
			</Popover>
		)
	},
)

export default MultiLangSetting

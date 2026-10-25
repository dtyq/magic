import { IconWorld } from "@tabler/icons-react"
import { Button, Flex, Form, Input, Popover } from "antd"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { PopoverProps } from "antd/lib"
import { LanguageType as LangType, useAdminComponents } from "../AdminComponentsProvider"
import type { MagicButtonProps } from "../MagicButton"
import MagicButton from "../MagicButton"
import ButtonGroup from "../ButtonGroup"
import MagicModal from "../MagicModal"
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
	/** 点击按钮展开或收起 */
	clickToToggle?: boolean
}

const MultiLangSetting = memo(
	({
		onSave,
		info,
		className,
		style,
		type,
		required,
		supportLangs = [LangType.en_US, LangType.zh_CN],
		supportType = "input",
		danger,
		popoverProps,
		disabled,
		clickToToggle,
		onClick,
		...props
	}: MultiLangSettingProps) => {
		const { styles, cx } = useStyles()

		const { getLocale } = useAdminComponents()
		const locale = getLocale("MultiLangSetting")

		const [open, setOpen] = useState(false)
		const confirmingCloseRef = useRef(false)

		const [form] = Form.useForm()

		const getInitialValues = useMemoizedFn(() => {
			const source = info as Record<string, string | undefined> | undefined
			return supportLangs.reduce<Record<string, string>>((values, lang) => {
				values[lang] = source?.[lang] ?? ""
				return values
			}, {})
		})

		const resetFormToInitialValues = useMemoizedFn(() => {
			form.resetFields()
			form.setFieldsValue(getInitialValues())
		})

		const hasUnsavedChanges = useMemoizedFn(() => {
			const currentValues = form.getFieldsValue(supportLangs) as Record<
				string,
				string | undefined
			>
			const initialValues = getInitialValues()

			return supportLangs.some(
				(lang) => (currentValues[lang] ?? "") !== (initialValues[lang] ?? ""),
			)
		})

		const closeWithoutSaving = useMemoizedFn(() => {
			resetFormToInitialValues()
			setOpen(false)
		})

		const onInnerSave = useMemoizedFn(async () => {
			const values = await form.validateFields()
			onSave?.(values)
			setOpen(false)
			form.resetFields()
		})

		const handleSaveAndClose = useMemoizedFn(async (closeConfirm?: () => void) => {
			await onInnerSave()
			closeConfirm?.()
			confirmingCloseRef.current = false
		})

		const requestClose = useMemoizedFn(() => {
			if (!hasUnsavedChanges()) {
				closeWithoutSaving()
				return
			}

			if (confirmingCloseRef.current) return
			confirmingCloseRef.current = true
			const closeConfirm = {
				current: undefined as (() => void) | undefined,
			}
			const confirmModal = MagicModal.confirm({
				centered: true,
				title: locale.confirmClose,
				content: locale.unsavedChanges,
				footer: () => (
					<Flex justify="end" gap={4} align="center">
						<Button
							type="default"
							onClick={() => {
								confirmingCloseRef.current = false
								closeConfirm.current?.()
							}}
						>
							{locale.continueEditing}
						</Button>
						<Button
							type="default"
							danger
							onClick={() => {
								confirmingCloseRef.current = false
								closeWithoutSaving()
								closeConfirm.current?.()
							}}
						>
							{locale.discard}
						</Button>
						<Button
							type="primary"
							onClick={() => handleSaveAndClose(closeConfirm.current)}
						>
							{locale.saveAndClose}
						</Button>
					</Flex>
				),
				afterClose: () => {
					confirmingCloseRef.current = false
				},
			})
			closeConfirm.current = confirmModal.destroy
		})

		const onButtonClick = useMemoizedFn((event: React.MouseEvent<HTMLButtonElement>) => {
			onClick?.(event)
			if (!clickToToggle) setOpen(true)
		})

		useEffect(() => {
			resetFormToInitialValues()
		}, [info, resetFormToInitialValues])

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
					<ButtonGroup onCancel={requestClose} onSave={onInnerSave} />
				</Form>
			)
		}, [
			form,
			styles.form,
			styles.formItem,
			supportLangs,
			requestClose,
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
					if (visible) {
						if (clickToToggle) setOpen(true)
						return
					}
					requestClose()
				}}
				trigger={clickToToggle ? "click" : undefined}
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
					onClick={onButtonClick}
					{...props}
				/>
			</Popover>
		)
	},
)

export default MultiLangSetting

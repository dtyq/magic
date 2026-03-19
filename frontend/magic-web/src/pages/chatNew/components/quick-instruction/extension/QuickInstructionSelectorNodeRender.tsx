import type { NodeViewProps } from "@tiptap/core"
import { NodeViewWrapper } from "@tiptap/react"
import type { MouseEvent } from "react"
import { memo, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Select } from "antd"
import { useMemoizedFn } from "ahooks"
import MagicIcon from "@/components/base/MagicIcon"
import { IconCaretDownFilled } from "@tabler/icons-react"
import { InstructionType } from "@/types/bot"
import { useMessageRenderContext } from "@/components/business/MessageRenderProvider/hooks"
import { ExtensionName } from "./constants"
import { useStyles } from "./styles"

const QuickInstructionSelectorNodeRender = (props: NodeViewProps) => {
	const {
		editor,
		node: {
			attrs: { instruction, value },
		},
		extension: {
			options: { HTMLAttributes, disabled = false, templateMode = false },
		},
	} = props

	const { t } = useTranslation("interface")
	const { hiddenDetail } = useMessageRenderContext()
	const { styles, cx } = useStyles({ inSubSider: hiddenDetail })

	const [selectedValue, setSelectedValue] = useState(value)

	useEffect(() => {
		setSelectedValue(value)
	}, [value])

	/** 点击事件, 阻止事件冒泡 */
	const handleClick = useMemoizedFn((e: MouseEvent<HTMLDivElement>) => {
		e.stopPropagation()
	})

	/** 选择值 */
	const handleChange = useMemoizedFn((v: string) => {
		setSelectedValue(v)
		editor?.commands.updateAttributes(ExtensionName, { value: v })
	})

	const arrowIcon = useMemo(() => {
		return (
			<MagicIcon
				size={14}
				color="currentColor"
				className={styles.icon}
				component={IconCaretDownFilled}
			/>
		)
	}, [styles.icon])

	if (templateMode) {
		return (
			<NodeViewWrapper
				as="span"
				data-type={ExtensionName}
				data-value={value}
				className={styles.templateMode}
				{...HTMLAttributes}
			>
				{t("chat.quickInstruction.instructionValue")}
			</NodeViewWrapper>
		)
	}

	if (!instruction) {
		return (
			<NodeViewWrapper
				as="span"
				data-type={ExtensionName}
				data-value={value}
				className={styles.nodeViewWrapper}
				{...HTMLAttributes}
			>
				<span className={styles.notFound}>
					{t("chat.quickInstruction.notFoundConfiguration")}
				</span>
			</NodeViewWrapper>
		)
	}

	switch (instruction.type) {
		case InstructionType.SINGLE_CHOICE:
			if (instruction.values && instruction.values.length === 1) {
				return (
					<NodeViewWrapper
						as="span"
						data-type={ExtensionName}
						data-value={value}
						className={cx(styles.nodeViewWrapper)}
						{...HTMLAttributes}
					>
						<div className={cx(styles.selectOnlyOneOption)}>
							{instruction.values[0].name}
						</div>
					</NodeViewWrapper>
				)
			}

			return (
				<NodeViewWrapper
					as="span"
					data-type={ExtensionName}
					data-value={value}
					className={styles.nodeViewWrapper}
					{...HTMLAttributes}
				>
					<Select
						className={cx(styles.select)}
						value={selectedValue}
						disabled={disabled}
						popupMatchSelectWidth={false}
						classNames={{ popup: { root: styles.popup } }}
						options={instruction.values?.map((v: any) => ({
							displayInOptions: v.name,
							label: v.value,
							value: v.id,
						}))}
						optionRender={({ data }) => {
							return <div>{data?.displayInOptions}</div>
						}}
						suffixIcon={arrowIcon}
						onChange={handleChange}
						onClick={handleClick}
						getPopupContainer={() => document.body}
					/>
				</NodeViewWrapper>
			)
		case InstructionType.SWITCH:
			if (!instruction || hiddenDetail) {
				return null
			}
			return (
				<NodeViewWrapper
					as="span"
					data-type={ExtensionName}
					data-value={value}
					className={cx(styles.switchWrapper)}
					{...HTMLAttributes}
				>
					{instruction?.name}
				</NodeViewWrapper>
			)
		default:
			return null
	}
}

export default memo(QuickInstructionSelectorNodeRender)

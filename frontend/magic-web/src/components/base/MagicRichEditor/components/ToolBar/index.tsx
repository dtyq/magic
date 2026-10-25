import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import {
	IconAlignCenter,
	IconAlignJustified,
	IconAlignLeft,
	IconAlignRight,
	IconArrowBackUp,
	IconArrowForwardUp,
	IconBold,
	IconItalic,
} from "@tabler/icons-react"
import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { useMemoizedFn } from "ahooks"
import { Flex, InputNumber, Select } from "antd"
import { createStyles } from "antd-style"
import type { HTMLAttributes } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"

const useStyles = createStyles(({ css }) => {
	return {
		toolbar: css``,
		headingText: css`
			font-size: 14px;
			font-weight: 500;
		`,
	}
})

interface ToolBarProps extends HTMLAttributes<HTMLDivElement> {
	editor: Editor | null
}

export default function ToolBar({ editor, ...props }: ToolBarProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const headingLevel = runActiveEditor(
		editor,
		(activeEditor) =>
			activeEditor.isActive("heading")
				? activeEditor.getAttributes("heading").level
				: "paragraph",
		"paragraph",
	)

	const fontSize = runActiveEditor(
		editor,
		(activeEditor) =>
			Number((activeEditor.getAttributes("textStyle")?.fontSize ?? "16px").slice(0, -2)),
		16,
	)

	const headingOptions = useMemo(() => {
		return [
			{ label: t("richEditor.paragraph"), value: "paragraph" },
			...Array.from({ length: 6 }).map((_, index) => ({
				label: <span className={styles.headingText}>H{index + 1}</span>,
				value: index + 1,
			})),
		]
	}, [styles.headingText, t])

	const onHeadingChange = useMemoizedFn((value: "paragraph" | 1 | 2 | 3 | 4 | 5 | 6) => {
		runActiveEditor(editor, (activeEditor) => {
			if (value === "paragraph") {
				activeEditor.chain().focus().setParagraph().run()
			} else {
				activeEditor.chain().focus().toggleHeading({ level: value }).run()
			}
		})
	})

	if (!editor) return null

	const canUndo = runActiveEditor(editor, (activeEditor) => activeEditor.can().undo(), false)
	const canRedo = runActiveEditor(editor, (activeEditor) => activeEditor.can().redo(), false)
	const isBold = runActiveEditor(editor, (activeEditor) => activeEditor.isActive("bold"), false)
	const isItalic = runActiveEditor(
		editor,
		(activeEditor) => activeEditor.isActive("italic"),
		false,
	)
	const isLeftAlign = runActiveEditor(
		editor,
		(activeEditor) => activeEditor.isActive({ textAlign: "left" }),
		false,
	)
	const isCenterAlign = runActiveEditor(
		editor,
		(activeEditor) => activeEditor.isActive({ textAlign: "center" }),
		false,
	)
	const isRightAlign = runActiveEditor(
		editor,
		(activeEditor) => activeEditor.isActive({ textAlign: "right" }),
		false,
	)
	const isJustifyAlign = runActiveEditor(
		editor,
		(activeEditor) => activeEditor.isActive({ textAlign: "justify" }),
		false,
	)

	return (
		<Flex gap={4} wrap="wrap" className={styles.toolbar} {...props}>
			<MagicButton
				type="link"
				disabled={!canUndo}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().undo().run()
					})
				}}
				icon={<MagicIcon component={IconArrowBackUp} stroke={2} />}
				tip={t("richEditor.undo")}
			/>
			<MagicButton
				type="link"
				disabled={!canRedo}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().redo().run()
					})
				}}
				icon={<MagicIcon component={IconArrowForwardUp} stroke={2} />}
				tip={t("richEditor.redo")}
			/>
			<Select
				style={{ width: 100 }}
				value={headingLevel}
				options={headingOptions}
				onChange={onHeadingChange}
			/>
			<InputNumber
				min={1}
				max={400}
				value={fontSize}
				defaultValue={16}
				onChange={(value) => {
					if (value) {
						runActiveEditor(editor, (activeEditor) => {
							activeEditor.chain().focus().setFontSize(`${value}px`).run()
						})
					}
				}}
			/>
			<MagicButton
				type={isBold ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().toggleBold().run()
					})
				}}
				icon={<MagicIcon component={IconBold} stroke={2} />}
				tip={t("richEditor.bold")}
			/>
			<MagicButton
				type={isItalic ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().toggleItalic().run()
					})
				}}
				icon={<MagicIcon component={IconItalic} stroke={2} />}
				tip={t("richEditor.italic")}
			/>
			<MagicButton
				type={isLeftAlign ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().setTextAlign("left").run()
					})
				}}
				icon={<MagicIcon component={IconAlignLeft} />}
				tip={t("richEditor.leftAlign")}
			/>
			<MagicButton
				type={isCenterAlign ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().setTextAlign("center").run()
					})
				}}
				icon={<MagicIcon component={IconAlignCenter} />}
				tip={t("richEditor.centerAlign")}
			/>
			<MagicButton
				type={isRightAlign ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().setTextAlign("right").run()
					})
				}}
				icon={<MagicIcon component={IconAlignRight} />}
				tip={t("richEditor.rightAlign")}
			/>
			<MagicButton
				type={isJustifyAlign ? "primary" : "link"}
				onClick={() => {
					runActiveEditor(editor, (activeEditor) => {
						activeEditor.chain().focus().setTextAlign("justify").run()
					})
				}}
				icon={<MagicIcon component={IconAlignJustified} />}
				tip={t("richEditor.justifyAlign")}
			/>
		</Flex>
	)
}

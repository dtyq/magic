import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
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
import type { Editor } from "@tiptap/react"
import { useMemoizedFn } from "ahooks"
import { Flex, InputNumber, Select } from "antd"
import { createStyles } from "antd-style"
import type { HTMLAttributes } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

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

	const headingLevel = editor?.isActive("heading")
		? editor.getAttributes("heading").level
		: "paragraph"

	const fontSize = Number((editor?.getAttributes("textStyle")?.fontSize ?? "16px").slice(0, -2))

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
		if (value === "paragraph") {
			editor?.chain().focus().setParagraph().run()
		} else {
			editor?.chain().focus().toggleHeading({ level: value }).run()
		}
	})

	if (!editor) return null

	return (
		<Flex gap={4} wrap="wrap" className={styles.toolbar} {...props}>
			<MagicButton
				type="link"
				disabled={!editor?.can().undo()}
				onClick={() => editor?.chain().focus().undo().run()}
				icon={<MagicIcon component={IconArrowBackUp} stroke={2} />}
				tip={t("richEditor.undo")}
			/>
			<MagicButton
				type="link"
				disabled={!editor?.can().redo()}
				onClick={() => editor?.chain().focus().redo().run()}
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
					if (value) editor?.chain().focus().setFontSize(`${value}px`).run()
				}}
			/>
			<MagicButton
				type={editor?.isActive("bold") ? "primary" : "link"}
				onClick={() => editor?.chain().focus().toggleBold().run()}
				icon={<MagicIcon component={IconBold} stroke={2} />}
				tip={t("richEditor.bold")}
			/>
			<MagicButton
				type={editor?.isActive("italic") ? "primary" : "link"}
				onClick={() => editor?.chain().focus().toggleItalic().run()}
				icon={<MagicIcon component={IconItalic} stroke={2} />}
				tip={t("richEditor.italic")}
			/>
			<MagicButton
				type={editor?.isActive({ textAlign: "left" }) ? "primary" : "link"}
				onClick={() => editor?.chain().focus().setTextAlign("left").run()}
				icon={<MagicIcon component={IconAlignLeft} />}
				tip={t("richEditor.leftAlign")}
			/>
			<MagicButton
				type={editor?.isActive({ textAlign: "center" }) ? "primary" : "link"}
				onClick={() => editor?.chain().focus().setTextAlign("center").run()}
				icon={<MagicIcon component={IconAlignCenter} />}
				tip={t("richEditor.centerAlign")}
			/>
			<MagicButton
				type={editor?.isActive({ textAlign: "right" }) ? "primary" : "link"}
				onClick={() => editor?.chain().focus().setTextAlign("right").run()}
				icon={<MagicIcon component={IconAlignRight} />}
				tip={t("richEditor.rightAlign")}
			/>
			<MagicButton
				type={editor?.isActive({ textAlign: "justify" }) ? "primary" : "link"}
				onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
				icon={<MagicIcon component={IconAlignJustified} />}
				tip={t("richEditor.justifyAlign")}
			/>
		</Flex>
	)
}

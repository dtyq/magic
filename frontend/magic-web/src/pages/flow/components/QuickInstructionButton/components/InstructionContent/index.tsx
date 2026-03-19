import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Form } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { InstructionType } from "@/types/bot"
import { resolveToString } from "@dtyq/es6-template-strings"
import type { MagicRichEditorRef } from "@/components/base/MagicRichEditor"
import MagicRichEditor from "@/components/base/MagicRichEditor"
import type { UseEditorOptions } from "@tiptap/react"
import { IconAt } from "@tabler/icons-react"
import { useStyles } from "../../styles"

interface InstructionContentProps {
	editorRef: React.RefObject<MagicRichEditorRef>
	selectedValue: InstructionType
	editorOptions: UseEditorOptions
	insertInstruction: () => void
}
export const InstructionContent = memo(
	({ selectedValue, insertInstruction, editorRef, editorOptions }: InstructionContentProps) => {
		const { t } = useTranslation("interface")
		const { styles, cx } = useStyles()

		return (
			<Flex vertical gap={8}>
				<Flex gap={6} vertical>
					<Flex justify="space-between" align="center">
						<span className={cx(styles.labelText, styles.required)}>
							{t("explore.form.instructionContent")}
						</span>
						{selectedValue !== InstructionType.TEXT && (
							<MagicButton
								type="text"
								className={styles.atButton}
								onClick={insertInstruction}
							>
								<IconAt size={14} color="currentColor" />
								{t("explore.form.insertInstruction")}
							</MagicButton>
						)}
					</Flex>
					<Form.Item
						name="content"
						required
						rules={[
							{
								required: true,
								message: resolveToString(t("form.required"), {
									label: t("explore.form.instructionContent"),
								}),
							},
						]}
					>
						<MagicRichEditor
							ref={editorRef}
							showToolBar={false}
							className={styles.editor}
							placeholder={t("explore.form.instructionContentPlaceholder")}
							editorProps={editorOptions}
						/>
					</Form.Item>
				</Flex>
			</Flex>
		)
	},
)

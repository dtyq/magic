import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/simple-editor"

interface IdentityPromptPanelProps {
	open: boolean
	onClose: () => void
	initialValue: string
	onSave: (value: string) => void
	disabled?: boolean
}

export function IdentityPromptPanel({
	open,
	onClose,
	initialValue,
	onSave,
	disabled = false,
}: IdentityPromptPanelProps) {
	const { t } = useTranslation("crew/create")
	const editorRef = useRef<SimpleEditorRef>(null)
	const [draft, setDraft] = useState(initialValue)

	useEffect(() => {
		if (disabled && open) onClose()
	}, [disabled, onClose, open])

	const handleSave = useCallback(() => {
		onSave(draft)
	}, [draft, onSave])

	const handleReset = useCallback(() => {
		setDraft(initialValue)
		editorRef.current?.setContent(initialValue)
	}, [initialValue])

	const handleClose = useCallback(() => {
		onClose()
	}, [onClose])

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="absolute bottom-0 left-0 right-0 z-20 flex h-full flex-col rounded-t-lg bg-card shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]"
					initial={{ y: "100%" }}
					animate={{ y: 0 }}
					exit={{ y: "100%" }}
					transition={{ type: "spring", damping: 30, stiffness: 350 }}
					data-testid="crew-identity-prompt-panel"
				>
					<div className="flex shrink-0 items-center gap-3 px-3 pt-3">
						<p className="flex-1 truncate text-lg font-medium leading-none text-foreground">
							{t("card.prompt")}
						</p>
						<Button
							variant="ghost"
							size="icon"
							className="shrink-0"
							onClick={handleClose}
							disabled={disabled}
							data-testid="crew-identity-prompt-close"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>

					<div className="mx-3 my-2 min-h-0 flex-1 overflow-auto rounded-md border border-border">
						<SimpleEditor
							ref={editorRef}
							content={initialValue}
							onContentChange={setDraft}
							enableDragHandle={false}
							placeholder={t("card.prompt")}
						/>
					</div>

					<div className="flex shrink-0 items-center justify-between px-3 pb-3">
						<Button
							variant="outline"
							size="sm"
							onClick={handleReset}
							disabled={disabled}
							data-testid="crew-identity-prompt-reset"
						>
							{t("card.reset")}
						</Button>
						<div className="flex gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClose}
								disabled={disabled}
								data-testid="crew-identity-prompt-cancel"
							>
								{t("card.cancel")}
							</Button>
							<Button
								size="sm"
								onClick={handleSave}
								disabled={disabled}
								data-testid="crew-identity-prompt-save"
							>
								{t("card.save")}
							</Button>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

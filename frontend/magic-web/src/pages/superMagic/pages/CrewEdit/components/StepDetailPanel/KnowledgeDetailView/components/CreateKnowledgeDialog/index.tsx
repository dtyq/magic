import { Loader2 } from "lucide-react"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Label } from "@/components/shadcn-ui/label"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { CrewKnowledge } from "@/types/crew-knowledge"
import {
	KNOWLEDGE_CREATE_LABEL_COL_CLASS,
	KNOWLEDGE_TYPE_OPTIONS,
	IMPORT_SOURCE_OPTIONS,
} from "./constants"
import { TypeOptionRow } from "./components/TypeOptionRow"
import { SourceTypeOptionRow } from "./components/SourceTypeOptionRow"
import { useCreateKnowledgeDialogForm } from "./hooks/useCreateKnowledgeDialogForm"
import type { CreateKnowledgeDialogProps } from "./types"

function CreateKnowledgeDialog({
	open,
	onOpenChange,
	onSuccess,
	editKnowledge = null,
}: CreateKnowledgeDialogProps) {
	const { t } = useTranslation("crew/create")
	const {
		loading,
		name,
		setName,
		description,
		setDescription,
		selectedType,
		selectedSource,
		fieldErrors,
		isEditing,
		clearNameError,
		toggleType,
		toggleSource,
		runSubmit,
	} = useCreateKnowledgeDialogForm({
		open,
		onOpenChange,
		onSuccess,
		editKnowledge,
	})

	// 是否显示 Import 区域
	const showImportSection =
		!isEditing && selectedType === CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing
							? t("knowledgeBase.edit")
							: t("knowledgeBase.create.dialogTitle")}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-2.5 py-4">
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2">
							<Label
								htmlFor="knowledge-create-name"
								className={KNOWLEDGE_CREATE_LABEL_COL_CLASS}
							>
								{t("knowledgeBase.create.title")}
							</Label>
							<Input
								id="knowledge-create-name"
								value={name}
								onChange={(e) => {
									setName(e.target.value)
									clearNameError()
								}}
								placeholder={t("knowledgeBase.create.titlePlaceholder")}
								maxLength={50}
								aria-invalid={Boolean(fieldErrors.name)}
								className={cn(
									"flex-1",
									fieldErrors.name &&
										"border-destructive focus-visible:ring-destructive",
								)}
							/>
						</div>
						{fieldErrors.name ? (
							<p className="ml-[calc(6rem+0.5rem)] text-xs text-destructive">
								{fieldErrors.name}
							</p>
						) : null}
					</div>

					<div className="flex items-start gap-2">
						<Label className="w-24 shrink-0 pt-2 text-base font-medium">
							{t("knowledgeBase.create.description")}
						</Label>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t("knowledgeBase.create.descriptionPlaceholder")}
							rows={3}
							maxLength={200}
							className="flex-1"
						/>
					</div>

					{!isEditing ? (
						<>
							{/* Type 选择区域 */}
							<div className="flex flex-col gap-1.5">
								<div className="flex items-start gap-2">
									<Label className="w-24 shrink-0 pt-3 text-base font-medium">
										{t("knowledgeBase.create.typeLabel")}
									</Label>
									<div
										className={cn(
											"flex flex-1 flex-col gap-2",
											fieldErrors.type &&
												"rounded-lg ring-2 ring-destructive ring-offset-2",
										)}
										aria-invalid={Boolean(fieldErrors.type)}
									>
										{KNOWLEDGE_TYPE_OPTIONS.map((option) => (
											<TypeOptionRow
												key={option.value}
												option={option}
												selected={selectedType === option.value}
												disabled={option.disabled}
												onSelect={() => toggleType(option.value)}
												label={t(`knowledgeBase.create.${option.labelKey}`)}
											/>
										))}
									</div>
								</div>
								{fieldErrors.type ? (
									<p className="ml-[calc(6rem+0.5rem)] text-xs text-destructive">
										{fieldErrors.type}
									</p>
								) : null}
							</div>

							{/* Import 区域 - 仅当 Type 为 Documents 时显示 */}
							{showImportSection ? (
								<div
									className={cn(
										"space-y-2 rounded-lg bg-[#F5F5F5] p-3.5",
										fieldErrors.source &&
											"ring-2 ring-destructive ring-offset-2",
									)}
									aria-invalid={Boolean(fieldErrors.source)}
								>
									<Label className="text-base font-medium">
										{t("knowledgeBase.create.importLabel")}
									</Label>
									<div className="space-y-2" role="list">
										{IMPORT_SOURCE_OPTIONS.map((option) => (
											<SourceTypeOptionRow
												key={option.value}
												option={option}
												selected={selectedSource === option.value}
												disabled={option.disabled}
												onSelect={() => toggleSource(option.value)}
												label={t(`knowledgeBase.create.${option.labelKey}`)}
												description={t(
													`knowledgeBase.create.${option.descKey}`,
												)}
											/>
										))}
									</div>
									{fieldErrors.source ? (
										<p className="text-xs text-destructive">
											{fieldErrors.source}
										</p>
									) : null}
								</div>
							) : null}
						</>
					) : null}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						{t("common.cancel")}
					</Button>
					{!isEditing ? (
						<Button
							variant="outline"
							onClick={() => void runSubmit("createOnly")}
							disabled={loading}
						>
							{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							{t("knowledgeBase.create.createOnly")}
						</Button>
					) : null}
					<Button
						onClick={() => void runSubmit(isEditing ? "edit" : "createAndImport")}
						disabled={loading}
					>
						{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						{isEditing ? t("common.save") : t("knowledgeBase.create.createAndImport")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default CreateKnowledgeDialog
export type { CreateKnowledgeDialogProps } from "./types"

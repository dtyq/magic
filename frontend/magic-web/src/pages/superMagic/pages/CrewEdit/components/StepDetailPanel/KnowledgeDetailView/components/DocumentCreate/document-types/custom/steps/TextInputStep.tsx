import { observer } from "mobx-react-lite"
import { useMemo, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { FileText } from "lucide-react"
import { SimpleEditor, SimpleEditorRef } from "@/components/tiptap-templates/simple/simple-editor"
import { StepNavigation } from "../../../components"
import type { CustomContentStore } from "../../../store"

/**
 * TextInputStep组件Props
 */
export interface TextInputStepProps {
	store: CustomContentStore
	onNext: () => void
	onPrevious: () => void
}

/**
 * Custom Content第1步：输入文本
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2060571
 */
export const TextInputStep = observer(function TextInputStep({
	store,
	onNext,
}: TextInputStepProps) {
	const { t } = useTranslation("crew/create")
	const simpleEditorRef = useRef<SimpleEditorRef>(null)

	/**
	 * 初始化编辑器内容
	 */
	useEffect(() => {
		if (simpleEditorRef.current && store.documentContent) {
			simpleEditorRef.current.setContent(store.documentContent)
		}
		// 只在组件挂载时执行一次
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	/**
	 * 处理文档名称变更
	 */
	const handleNameChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		store.setDocumentName(e.target.value)
	})

	/**
	 * 处理内容变更
	 */
	const handleContentChange = useMemoizedFn((markdown: string) => {
		store.setDocumentContent(markdown)
	})

	// 计算是否可以进入下一步
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const canGoNext = useMemo(() => store.canGoNext(1), [store.documentName, store.documentContent])

	// 阻止所有按键事件冒泡
	const handleKeyDown = (event: React.KeyboardEvent) => {
		event.stopPropagation()
	}

	return (
		<div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
			{/* 固定区域：标题和文档名称输入 */}
			<div className="shrink-0 space-y-4 px-8 pb-4 pt-0">
				{/* 文档名称输入 */}
				<div className="space-y-2">
					<Label htmlFor="document-name" className="text-sm font-medium">
						{t("documentCreate.customContent.textInput.documentName")}
					</Label>
					<div className="relative">
						<FileText className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							id="document-name"
							value={store.documentName}
							onChange={handleNameChange}
							placeholder={t(
								"documentCreate.customContent.textInput.documentNamePlaceholder",
							)}
							className="pl-10"
						/>
					</div>
				</div>
			</div>

			{/* 可滚动区域：富文本编辑器 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-8">
				<div className="space-y-3 pb-4">
					{/* 编辑器标签 */}
					<div className="flex items-center justify-between">
						<Label htmlFor="custom-content" className="text-sm font-medium">
							{t("documentCreate.customContent.textInput.title")}
						</Label>
					</div>
					{/* 富文本编辑器 */}
					<div className="rounded-lg border border-border text-base">
						<div className="document-create-editor-wrapper rounded-lg">
							<SimpleEditor
								ref={simpleEditorRef}
								content=""
								onUpdate={({ editor: _editor }) => {
									const markdown =
										(
											_editor.storage as {
												markdown?: { getMarkdown: () => string }
											}
										).markdown?.getMarkdown() || ""
									handleContentChange(markdown)
								}}
								isEditable={true}
								enableDragHandle={true}
								className="rounded-lg"
								placeholder={t(
									"documentCreate.customContent.textInput.editorPlaceholder",
								)}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* 底部导航 - 始终固定在底部 */}
			<div className="shrink-0 py-6">
				<StepNavigation showPrevious={false} onNext={onNext} nextDisabled={!canGoNext} />
			</div>
		</div>
	)
})

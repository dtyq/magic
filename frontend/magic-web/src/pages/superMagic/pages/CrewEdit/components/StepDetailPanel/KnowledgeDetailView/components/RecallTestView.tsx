import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { LayoutList, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Separator } from "@/components/shadcn-ui/separator"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { KnowledgeApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import magicToast from "@/components/base/MagicToaster/utils"
import { getExternalFileIconByType } from "@/pages/vectorKnowledge/constant"
import { useCrewEditStore } from "../../../../context"
import { KnowledgeSubPageHeader } from "./KnowledgeSubPageHeader"

interface RecallTestViewProps {
	knowledgeCode: string
	onClose: () => void
}

/**
 * Test retrieval recall against the selected knowledge base.
 */
export function RecallTestView({ knowledgeCode, onClose }: RecallTestViewProps) {
	const { t } = useTranslation("crew/create")
	const { knowledge } = useCrewEditStore()

	// Resolve the selected knowledge base from the crew editor's store.
	const currentKnowledge = useMemo(
		() =>
			knowledge.knowledgeList.find(
				(kb: Knowledge.KnowledgeItem) => kb.code === knowledgeCode,
			),
		[knowledge.knowledgeList, knowledgeCode],
	)

	// Test query.
	const [testText, setTestText] = useState("")
	// Recall results.
	const [results, setResults] = useState<{
		total: number
		list: Knowledge.FragmentItem[]
	}>({
		total: 0,
		list: [],
	})
	// Loading state.
	const [recallLoading, setRecallLoading] = useState(false)

	// Update the test query.
	const handleTextChange = useMemoizedFn((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setTestText(e.target.value)
	})

	/**
	 * Run the recall test.
	 */
	const handleTest = useMemoizedFn(async () => {
		if (!testText.trim()) {
			magicToast.warning(t("recallTest.inputPlaceholder"))
			return
		}

		setRecallLoading(true)
		try {
			const res = await KnowledgeApi.recallTest({
				knowledge_code: knowledgeCode,
				query: testText,
			})
			if (res && res.list) {
				setResults({
					total: res.total,
					list: res.list,
				})
			}
			magicToast.success(t("recallTest.testSuccess"))
		} catch (error) {
			console.error("召回测试失败:", error)
			magicToast.error(t("recallTest.testFailed"))
		} finally {
			setRecallLoading(false)
		}
	})

	// Prevent repeated submissions while the user clicks the test button.
	const { run: debouncedHandleTest } = useDebounceFn(handleTest, {
		wait: 300,
		leading: true,
		trailing: false,
	})

	// Build the result count label.
	const resultsHeaderText = useMemo(() => {
		return t("recallTest.recallParagraphs", { count: results.total })
	}, [results.total, t])

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<KnowledgeSubPageHeader
				knowledgeName={currentKnowledge?.name || ""}
				title={t("recallTest.title")}
				onBack={onClose}
				onClose={onClose}
			/>

			{/* Content */}
			<div className="mt-3.5 flex min-h-0 flex-1 gap-5 overflow-hidden">
				{/* Left panel: test input */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="mb-3">
						<h3 className="mb-1 text-base font-semibold">{t("recallTest.title")}</h3>
						<p className="text-xs text-muted-foreground">
							{t("recallTest.description")}
						</p>
					</div>

					{/* Query input */}
					<div className="mb-4 overflow-hidden rounded-lg border shadow-sm">
						<div className="bg-muted/50 px-3 py-2">
							<h4 className="text-sm font-medium">{t("recallTest.sourceText")}</h4>
						</div>
						<div className="bg-background p-2">
							<Textarea
								className="min-h-[150px] resize-none border-none shadow-none focus-visible:ring-0"
								value={testText}
								onChange={handleTextChange}
								placeholder={t("recallTest.inputPlaceholder")}
							/>
						</div>
						<div className="flex justify-end border-t bg-background p-3">
							<Button onClick={debouncedHandleTest} disabled={recallLoading}>
								{t("recallTest.test")}
							</Button>
						</div>
					</div>
				</div>

				<Separator orientation="vertical" className="h-auto" />

				{/* Right panel: recall results */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* Result header */}
					<div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
						<LayoutList className="size-4" />
						<span>{resultsHeaderText}</span>
					</div>

					{/* Result content */}
					{/* Fill the viewport to keep loading and empty results centered. */}
					<ScrollArea
						className="grid min-h-0 flex-1 rounded-lg border bg-muted/20"
						viewportClassName="h-auto min-h-0 [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col"
					>
						{recallLoading ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-3">
								<Loader2 className="size-8 animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">
									{t("recallTest.loading")}
								</p>
							</div>
						) : (
							<div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
								{results.list.length > 0 ? (
									results.list.map((item) => (
										<div
											key={item.id}
											className="min-w-0 max-w-full overflow-hidden rounded-lg border bg-background p-4 shadow-sm transition-shadow hover:shadow-md"
										>
											{/* Fragment metadata */}
											<div className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
												<LayoutList className="size-4" />
												<span>{t("recallTest.segment")}</span>
												<span>/</span>
												<span>
													{t("recallTest.wordCount", {
														count: item.word_count,
													})}
												</span>
												<span>/</span>
												<span>Score</span>
												<span className="font-medium text-foreground">
													{typeof item.score === "number"
														? item.score.toFixed(2)
														: "**"}
												</span>
											</div>

											{/* Fragment content */}
											<div className="mb-3 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
												{item.content}
											</div>

											{/* Document information */}
											<div className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
												{getExternalFileIconByType(item.document_type, 16)}
												<span className="min-w-0 truncate">
													{item.document_name}
												</span>
											</div>
										</div>
									))
								) : (
									<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
										{t("recallTest.noResults")}
									</div>
								)}
							</div>
						)}
					</ScrollArea>
				</div>
			</div>
		</div>
	)
}

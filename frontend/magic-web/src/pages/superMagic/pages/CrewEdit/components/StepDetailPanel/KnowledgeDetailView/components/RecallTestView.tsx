import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { LayoutList, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Separator } from "@/components/shadcn-ui/separator"
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
 * 召回测试视图组件
 * 用于测试知识库的检索召回能力
 */
export function RecallTestView({ knowledgeCode, onClose }: RecallTestViewProps) {
	const { t } = useTranslation("crew/create")
	const { knowledge } = useCrewEditStore()

	// 获取当前知识库信息
	const currentKnowledge = useMemo(
		() =>
			knowledge.knowledgeList.find(
				(kb: Knowledge.KnowledgeItem) => kb.code === knowledgeCode,
			),
		[knowledge.knowledgeList, knowledgeCode],
	)

	// 测试文本
	const [testText, setTestText] = useState("")
	// 测试结果
	const [results, setResults] = useState<{
		total: number
		list: Knowledge.FragmentItem[]
	}>({
		total: 0,
		list: [],
	})
	// 加载状态
	const [recallLoading, setRecallLoading] = useState(false)

	// 处理输入文本变更
	const handleTextChange = useMemoizedFn((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setTestText(e.target.value)
	})

	/**
	 * 执行测试
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

	// 防抖处理
	const { run: debouncedHandleTest } = useDebounceFn(handleTest, {
		wait: 300,
		leading: true,
		trailing: false,
	})

	// 计算结果提示文本
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
				{/* 左侧面板 - 测试输入 */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="mb-3">
						<h3 className="mb-1 text-base font-semibold">{t("recallTest.title")}</h3>
						<p className="text-xs text-muted-foreground">
							{t("recallTest.description")}
						</p>
					</div>

					{/* 输入区域 */}
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

				{/* 右侧面板 - 测试结果 */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* 结果头部 */}
					<div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
						<LayoutList className="size-4" />
						<span>{resultsHeaderText}</span>
					</div>

					{/* 结果内容区域 */}
					<div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20">
						{recallLoading ? (
							<div className="flex h-full flex-col items-center justify-center gap-3">
								<Loader2 className="size-8 animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">
									{t("recallTest.loading")}
								</p>
							</div>
						) : (
							<div className="space-y-3 p-4">
								{results.list.length > 0 ? (
									results.list.map((item) => (
										<div
											key={item.id}
											className="rounded-lg border bg-background p-4 shadow-sm transition-shadow hover:shadow-md"
										>
											{/* 片段头部信息 */}
											<div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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

											{/* 片段内容 */}
											<div className="mb-3 text-sm leading-relaxed text-foreground">
												{item.content}
											</div>

											{/* 文档信息 */}
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
												{getExternalFileIconByType(item.document_type, 16)}
												<span className="truncate">
													{item.document_name}
												</span>
											</div>
										</div>
									))
								) : (
									<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
										{t("recallTest.noResults")}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

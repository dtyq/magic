import { observer } from "mobx-react-lite"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useMount } from "ahooks"
import { ChevronDown } from "lucide-react"
import { Label } from "@/components/shadcn-ui/label"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Separator } from "@/components/shadcn-ui/separator"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Badge } from "@/components/shadcn-ui/badge"
import { KnowledgeApi } from "@/apis"
import { Knowledge } from "@/types/knowledge"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { StepNavigation } from "../../../components"
import {
	PARSING_STRATEGIES,
	CHUNKING_STRATEGIES,
	CHUNK_SEPARATORS,
	PREPROCESSING_RULES,
	type ParsingStrategy,
	type ChunkingStrategy,
	type ChunkSeparator,
	type PreprocessingRule,
} from "../../../constants"
import type { LocalDocumentStore } from "../../../store"
import { cn } from "@/lib/utils"

/**
 * StrategyConfigStep组件Props
 */
export interface StrategyConfigStepProps {
	store: LocalDocumentStore
	onNext: () => void
	onPrevious: () => void
	showPrevious?: boolean // 是否显示上一步按钮
}

/**
 * Local Documents第2步：策略配置
 * 一比一还原Figma设计，包含文档解析策略和分块策略
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-1889099
 */
export const StrategyConfigStep = observer(function StrategyConfigStep({
	store,
	onNext,
	onPrevious,
	showPrevious = true,
}: StrategyConfigStepProps) {
	const { t } = useTranslation("crew/create")

	// 折叠状态
	const [parsingExpanded, setParsingExpanded] = useState(true)
	const [chunkingExpanded, setChunkingExpanded] = useState(true)

	/**
	 * 检测文档是否包含层级结构
	 * 在组件挂载时调用，用于决定是否显示层级分块推荐
	 */
	useMount(async () => {
		// 只在有上传文件时检测
		const selectedFile = store.uploadedFiles.find((f) => f.status === "done" && f.key)
		if (!selectedFile) {
			store.setHasHierarchy(false)
			return
		}

		try {
			// 使用快速解析检测层级结构（不保存到 store）
			const response = await KnowledgeApi.crewSegmentPreview({
				strategy_config: {
					parsing_type: 0, // 快速解析即可检测层级
					image_extraction: false,
					table_extraction: false,
					image_ocr: false,
				},
				fragment_config: {
					mode: CrewKnowledge.SegmentationMode.AUTO, // 自动分块
				},
				document_file: {
					name: selectedFile.name,
					key: selectedFile.key || selectedFile.path || "",
					type: Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE,
					third_file_id: "",
				},
			})

			// 检查是否存在层级节点（level >= 0 表示标题节点）
			const hasHierarchy =
				response.document_nodes?.some((node: any) => node.level >= 0) || false
			store.setHasHierarchy(hasHierarchy)
		} catch (error) {
			console.error("层级检测失败:", error)
			// 检测失败时默认不显示推荐
			store.setHasHierarchy(false)
		}
	})

	/**
	 * 选择解析策略（点击卡片）
	 */
	const handleParsingStrategyClick = useMemoizedFn((strategy: ParsingStrategy) => {
		store.updateStrategyConfig({
			parsingStrategy: strategy,
			enablePreciseParsing: true,
		})
	})

	/**
	 * 控制详细配置显示
	 */
	const handlePreciseParsingToggle = useMemoizedFn((checked: boolean) => {
		store.updateStrategyConfig({ enablePreciseParsing: checked })
	})

	/**
	 * 处理提取选项变更
	 */
	const handleExtractChange = useMemoizedFn((field: string, checked: boolean) => {
		store.updateStrategyConfig({ [field]: checked })
	})

	/**
	 * 选择分块策略（点击卡片）
	 */
	const handleChunkingStrategyClick = useMemoizedFn((strategy: ChunkingStrategy) => {
		store.updateStrategyConfig({
			chunkingStrategy: strategy,
			enableChunkingConfig: true,
		})
	})

	/**
	 * 控制详细配置显示
	 */
	const handleChunkingConfigToggle = useMemoizedFn((checked: boolean) => {
		store.updateStrategyConfig({ enableChunkingConfig: checked })
	})

	/**
	 * 处理分块分隔符变更
	 */
	const handleChunkSeparatorChange = useMemoizedFn((value: string) => {
		store.updateStrategyConfig({ chunkSeparator: value as ChunkSeparator })
	})

	/**
	 * 处理最大块长度变更
	 */
	const handleMaxChunkLengthChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		if (value === "" || value === "-") {
			// 允许清空或输入负号（临时状态）
			store.updateStrategyConfig({ maxChunkLength: value as any })
			return
		}
		const numValue = Number.parseInt(value)
		if (!Number.isNaN(numValue) && numValue > 0) {
			store.updateStrategyConfig({ maxChunkLength: numValue })
		}
	})

	/**
	 * 处理最大块长度失去焦点
	 */
	const handleMaxChunkLengthBlur = useMemoizedFn(() => {
		const current = store.strategyConfig.maxChunkLength
		if (typeof current === "string" || current <= 0) {
			// 恢复默认值
			store.updateStrategyConfig({ maxChunkLength: 800 })
		}
	})

	/**
	 * 处理块重叠变更
	 */
	const handleChunkOverlapChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		if (value === "" || value === "-") {
			// 允许清空或输入负号（临时状态）
			store.updateStrategyConfig({ chunkOverlap: value as any })
			return
		}
		const numValue = Number.parseInt(value)
		if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
			store.updateStrategyConfig({ chunkOverlap: numValue })
		}
	})

	/**
	 * 处理块重叠失去焦点
	 */
	const handleChunkOverlapBlur = useMemoizedFn(() => {
		const current = store.strategyConfig.chunkOverlap
		if (typeof current === "string" || current < 0 || current > 100) {
			// 恢复默认值
			store.updateStrategyConfig({ chunkOverlap: 10 })
		}
	})

	/**
	 * 处理块层级变更
	 */
	const handleChunkHierarchyChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		if (value === "" || value === "-") {
			// 允许清空或输入负号（临时状态）
			store.updateStrategyConfig({ chunkHierarchy: value as any })
			return
		}
		const numValue = Number.parseInt(value)
		if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 6) {
			store.updateStrategyConfig({ chunkHierarchy: numValue })
		}
	})

	/**
	 * 处理块层级失去焦点
	 */
	const handleChunkHierarchyBlur = useMemoizedFn(() => {
		const current = store.strategyConfig.chunkHierarchy
		if (typeof current === "string" || current < 1 || current > 6) {
			// 恢复默认值
			store.updateStrategyConfig({ chunkHierarchy: 3 })
		}
	})

	/**
	 * 处理保留层级信息变更
	 */
	const handlePreserveHierarchyChange = useMemoizedFn((checked: boolean) => {
		store.updateStrategyConfig({ preserveHierarchy: checked })
	})

	/**
	 * 处理预处理规则变更
	 */
	const handlePreprocessingRuleChange = useMemoizedFn(
		(rule: PreprocessingRule, checked: boolean) => {
			const currentRules = store.strategyConfig.preprocessingRules
			const newRules = checked
				? [...currentRules, rule]
				: currentRules.filter((r) => r !== rule)
			store.updateStrategyConfig({ preprocessingRules: newRules })
		},
	)

	const isQuickParse = store.strategyConfig.parsingStrategy === PARSING_STRATEGIES.QUICK
	const isPreciseParsing = store.strategyConfig.parsingStrategy === PARSING_STRATEGIES.PRECISE
	const isAutoChunking = store.strategyConfig.chunkingStrategy === CHUNKING_STRATEGIES.AUTO
	const isCustomChunking = store.strategyConfig.chunkingStrategy === CHUNKING_STRATEGIES.CUSTOM
	const isHierarchicalChunking =
		store.strategyConfig.chunkingStrategy === CHUNKING_STRATEGIES.HIERARCHICAL

	return (
		<div className="flex h-full flex-col">
			{/* 可滚动区域：策略配置表单 */}
			<div className="min-h-0 flex-1 overflow-y-auto p-8">
				<div className="flex flex-col gap-4">
					{/* ===== 文档解析策略 ===== */}
					<div className="rounded-lg border border-border bg-card">
						{/* 标题栏 - 可折叠 */}
						<button
							className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-accent/50"
							onClick={() => setParsingExpanded(!parsingExpanded)}
						>
							<span className="text-sm font-medium">
								{t("documentCreate.strategy.parsingStrategy")}
							</span>
							<ChevronDown
								className={cn(
									"size-4 transition-transform",
									parsingExpanded && "rotate-180",
								)}
							/>
						</button>

						{/* 内容区域 */}
						{parsingExpanded && (
							<div className="space-y-2 px-3 pb-3">
								{/* Quick Parse - 带Checkbox的卡片 */}
								<div
									className={cn(
										"cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50",
										isQuickParse ? "border-foreground" : "border-border",
									)}
									onClick={() =>
										handleParsingStrategyClick(PARSING_STRATEGIES.QUICK)
									}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1">
											<div className="text-base font-medium">
												{t("documentCreate.strategy.quickParse")}
											</div>
											<p className="mt-1 text-xs leading-normal text-muted-foreground">
												{t("documentCreate.strategy.quickParseDesc")}
											</p>
										</div>
										{isQuickParse && (
											<Checkbox
												id="enable-quick-parse"
												checked={store.strategyConfig.enablePreciseParsing}
												onCheckedChange={handlePreciseParsingToggle}
												onClick={(e) => e.stopPropagation()}
												className="mt-0.5"
											/>
										)}
									</div>
								</div>

								{/* Precise Parsing - 带Checkbox的卡片 */}
								<div
									className={cn(
										"cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50",
										isPreciseParsing ? "border-foreground" : "border-border",
									)}
									onClick={() =>
										handleParsingStrategyClick(PARSING_STRATEGIES.PRECISE)
									}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1">
											<div className="text-base font-medium">
												{t("documentCreate.strategy.preciseParsing")}
											</div>
											<p className="mt-1 text-xs leading-normal text-muted-foreground">
												{t("documentCreate.strategy.preciseParsingDesc")}
											</p>
										</div>
										{isPreciseParsing && (
											<Checkbox
												id="enable-precise-parsing"
												checked={store.strategyConfig.enablePreciseParsing}
												onCheckedChange={handlePreciseParsingToggle}
												onClick={(e) => e.stopPropagation()}
												className="mt-0.5"
											/>
										)}
									</div>

									{/* Extract Content - 仅在Checkbox选中时显示 */}
									{isPreciseParsing &&
										store.strategyConfig.enablePreciseParsing && (
											<>
												<Separator className="my-3" />

												<div
													className="space-y-2"
													onClick={(e) => e.stopPropagation()}
												>
													<div className="text-sm font-medium">
														{t(
															"documentCreate.strategy.extractContent",
														)}
													</div>

													{/* Image Elements */}
													<div className="flex items-start gap-3 rounded-lg border border-border p-3">
														<Checkbox
															id="extract-images"
															checked={
																store.strategyConfig.extractImages
															}
															onCheckedChange={(checked) =>
																handleExtractChange(
																	"extractImages",
																	checked as boolean,
																)
															}
														/>
														<div className="flex-1">
															<Label
																htmlFor="extract-images"
																className="cursor-pointer text-sm"
															>
																{t(
																	"documentCreate.strategy.imageElements",
																)}
															</Label>
															<p className="mt-2 text-xs leading-normal text-muted-foreground">
																{t(
																	"documentCreate.strategy.imageElementsDesc",
																)}
															</p>
														</div>
													</div>

													{/* OCR Recognition */}
													<div className="flex items-start gap-3 rounded-lg border border-border p-3">
														<Checkbox
															id="extract-ocr"
															checked={
																store.strategyConfig.extractOCR
															}
															onCheckedChange={(checked) =>
																handleExtractChange(
																	"extractOCR",
																	checked as boolean,
																)
															}
														/>
														<div className="flex-1">
															<Label
																htmlFor="extract-ocr"
																className="cursor-pointer text-sm"
															>
																{t(
																	"documentCreate.strategy.ocrRecognition",
																)}
															</Label>
															<p className="mt-2 text-xs leading-normal text-muted-foreground">
																{t(
																	"documentCreate.strategy.ocrRecognitionDesc",
																)}
															</p>
														</div>
													</div>

													{/* Table Elements */}
													<div className="flex items-start gap-3 rounded-lg border border-border p-3">
														<Checkbox
															id="extract-tables"
															checked={
																store.strategyConfig.extractTables
															}
															onCheckedChange={(checked) =>
																handleExtractChange(
																	"extractTables",
																	checked as boolean,
																)
															}
														/>
														<div className="flex-1">
															<Label
																htmlFor="extract-tables"
																className="cursor-pointer text-sm"
															>
																{t(
																	"documentCreate.strategy.tableElements",
																)}
															</Label>
															<p className="mt-2 text-xs leading-normal text-muted-foreground">
																{t(
																	"documentCreate.strategy.tableElementsDesc",
																)}
															</p>
														</div>
													</div>
												</div>
											</>
										)}
								</div>
							</div>
						)}
					</div>

					{/* ===== 分块策略 ===== */}
					<div className="rounded-lg border border-border bg-card">
						{/* 标题栏 - 可折叠 */}
						<button
							className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-accent/50"
							onClick={() => setChunkingExpanded(!chunkingExpanded)}
						>
							<span className="text-sm font-medium">
								{t("documentCreate.strategy.chunkingStrategy")}
							</span>
							<ChevronDown
								className={cn(
									"size-4 transition-transform",
									chunkingExpanded && "rotate-180",
								)}
							/>
						</button>

						{/* 内容区域 */}
						{chunkingExpanded && (
							<div className="space-y-2 px-3 pb-3">
								{/* Auto Chunk & Clean - 带Checkbox的卡片 */}
								<div
									className={cn(
										"cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50",
										isAutoChunking ? "border-foreground" : "border-border",
									)}
									onClick={() =>
										handleChunkingStrategyClick(CHUNKING_STRATEGIES.AUTO)
									}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1">
											<div className="text-base font-medium">
												{t("documentCreate.strategy.autoChunkClean")}
											</div>
											<p className="mt-1 text-xs leading-normal text-muted-foreground">
												{t("documentCreate.strategy.autoChunkCleanDesc")}
											</p>
										</div>
										{isAutoChunking && (
											<Checkbox
												id="enable-auto-chunk"
												checked={store.strategyConfig.enableChunkingConfig}
												onCheckedChange={handleChunkingConfigToggle}
												onClick={(e) => e.stopPropagation()}
												className="mt-0.5"
											/>
										)}
									</div>
								</div>

								{/* Custom Chunking - 带Checkbox的卡片 */}
								<div
									className={cn(
										"cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50",
										isCustomChunking ? "border-foreground" : "border-border",
									)}
									onClick={() =>
										handleChunkingStrategyClick(CHUNKING_STRATEGIES.CUSTOM)
									}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1">
											<div className="text-base font-medium">
												{t("documentCreate.strategy.customChunking")}
											</div>
											<p className="mt-1 text-xs leading-normal text-muted-foreground">
												{t("documentCreate.strategy.customChunkingDesc")}
											</p>
										</div>
										{isCustomChunking && (
											<Checkbox
												id="enable-custom-chunking"
												checked={store.strategyConfig.enableChunkingConfig}
												onCheckedChange={handleChunkingConfigToggle}
												onClick={(e) => e.stopPropagation()}
												className="mt-0.5"
											/>
										)}
									</div>

									{/* Custom Chunking详细配置 - 仅在Checkbox选中时显示 */}
									{isCustomChunking &&
										store.strategyConfig.enableChunkingConfig && (
											<>
												<Separator className="my-3" />

												<div
													className="space-y-3"
													onClick={(e) => e.stopPropagation()}
												>
													{/* Chunk Separator、Max Chunk Length、Chunk Overlap 同一行 */}
													<div className="grid grid-cols-3 gap-3">
														{/* Chunk Separator */}
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																{t(
																	"documentCreate.strategy.chunkSeparator",
																)}
															</Label>
															<Select
																value={
																	store.strategyConfig
																		.chunkSeparator
																}
																onValueChange={
																	handleChunkSeparatorChange
																}
															>
																<SelectTrigger className="w-full">
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem
																		value={
																			CHUNK_SEPARATORS.LINE_BREAK
																		}
																	>
																		{t(
																			"documentCreate.strategy.lineBreak",
																		)}
																	</SelectItem>
																	<SelectItem
																		value={
																			CHUNK_SEPARATORS.PARAGRAPH
																		}
																	>
																		{t(
																			"documentCreate.strategy.paragraph",
																		)}
																	</SelectItem>
																</SelectContent>
															</Select>
														</div>

														{/* Max Chunk Length */}
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																{t(
																	"documentCreate.strategy.maxChunkLength",
																)}
															</Label>
															<Input
																type="number"
																value={
																	store.strategyConfig
																		.maxChunkLength
																}
																onChange={
																	handleMaxChunkLengthChange
																}
																onBlur={handleMaxChunkLengthBlur}
																min={1}
															/>
														</div>

														{/* Chunk Overlap */}
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																{t(
																	"documentCreate.strategy.chunkOverlapPercent",
																)}
															</Label>
															<Input
																type="number"
																value={
																	store.strategyConfig
																		.chunkOverlap
																}
																onChange={handleChunkOverlapChange}
																onBlur={handleChunkOverlapBlur}
																min={0}
																max={100}
															/>
														</div>
													</div>

													{/* Text Preprocessing Rules */}
													<div className="space-y-2">
														<Label className="text-sm font-medium">
															{t(
																"documentCreate.strategy.textPreprocessingRules",
															)}
														</Label>

														{/* Replace whitespace */}
														<div className="flex items-start gap-3 rounded-lg border border-border p-3">
															<Checkbox
																id="replace-whitespace"
																checked={store.strategyConfig.preprocessingRules.includes(
																	PREPROCESSING_RULES.REPLACE_WHITESPACE,
																)}
																onCheckedChange={(checked) =>
																	handlePreprocessingRuleChange(
																		PREPROCESSING_RULES.REPLACE_WHITESPACE,
																		checked as boolean,
																	)
																}
															/>
															<Label
																htmlFor="replace-whitespace"
																className="flex-1 cursor-pointer text-sm"
															>
																{t(
																	"documentCreate.strategy.replaceWhitespace",
																)}
															</Label>
														</div>

														{/* Remove URLs */}
														<div className="flex items-start gap-3 rounded-lg border border-border p-3">
															<Checkbox
																id="remove-urls"
																checked={store.strategyConfig.preprocessingRules.includes(
																	PREPROCESSING_RULES.REMOVE_URLS,
																)}
																onCheckedChange={(checked) =>
																	handlePreprocessingRuleChange(
																		PREPROCESSING_RULES.REMOVE_URLS,
																		checked as boolean,
																	)
																}
															/>
															<Label
																htmlFor="remove-urls"
																className="flex-1 cursor-pointer text-sm"
															>
																{t(
																	"documentCreate.strategy.removeUrls",
																)}
															</Label>
														</div>
													</div>
												</div>
											</>
										)}
								</div>

								{/* Hierarchical Chunking - 带Checkbox和配置的卡片 */}
								<div
									className={cn(
										"cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50",
										isHierarchicalChunking
											? "border-foreground"
											: "border-border",
									)}
									onClick={() =>
										handleChunkingStrategyClick(
											CHUNKING_STRATEGIES.HIERARCHICAL,
										)
									}
								>
									<div className="flex items-start gap-3">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-base font-medium">
													{t("documentCreate.strategy.hierarchical")}
												</span>
												{/* 只在检测到层级结构时显示推荐 Badge */}
												{store.hasHierarchy && (
													<Badge
														variant="secondary"
														className="bg-amber-50 text-amber-600"
													>
														{t("documentCreate.strategy.recommended")}
													</Badge>
												)}
											</div>
											<p className="mt-1 text-xs leading-normal text-muted-foreground">
												{t("documentCreate.strategy.hierarchicalDesc")}
											</p>
										</div>
										{isHierarchicalChunking && (
											<Checkbox
												id="enable-hierarchical-chunking"
												checked={store.strategyConfig.enableChunkingConfig}
												onCheckedChange={handleChunkingConfigToggle}
												onClick={(e) => e.stopPropagation()}
												className="mt-0.5 shrink-0"
											/>
										)}
									</div>

									{/* Hierarchical详细配置 - 仅在Checkbox选中时显示 */}
									{isHierarchicalChunking &&
										store.strategyConfig.enableChunkingConfig && (
											<>
												<Separator className="my-3" />

												<div
													className="space-y-3"
													onClick={(e) => e.stopPropagation()}
												>
													{/* Chunk Hierarchy */}
													<div className="space-y-2">
														<Label className="text-sm font-medium">
															{t(
																"documentCreate.strategy.chunkHierarchy",
															)}
														</Label>
														<Input
															type="number"
															value={
																store.strategyConfig.chunkHierarchy
															}
															onChange={handleChunkHierarchyChange}
															onBlur={handleChunkHierarchyBlur}
															min={1}
															max={6}
														/>
													</div>

													{/* Preserve hierarchy */}
													<div className="flex items-center gap-2">
														<Checkbox
															id="preserve-hierarchy"
															checked={
																store.strategyConfig
																	.preserveHierarchy
															}
															onCheckedChange={
																handlePreserveHierarchyChange
															}
														/>
														<Label
															htmlFor="preserve-hierarchy"
															className="cursor-pointer text-sm"
														>
															{t(
																"documentCreate.strategy.preserveHierarchy",
															)}
														</Label>
													</div>
												</div>
											</>
										)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* 底部导航 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					onNext={onNext}
					onPrevious={onPrevious}
					showPrevious={showPrevious}
				/>
			</div>
		</div>
	)
})

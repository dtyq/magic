import { useState, type ChangeEvent, useCallback, useRef, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useParams, useSearchParams } from "react-router-dom"
import { useDebounceFn } from "ahooks"
import { CirclePlus, FileText, Search } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { CrewKnowledge } from "@/types/crew-knowledge"
import useNavigate from "@/routes/hooks/useNavigate"
import { useCrewEditStore } from "../../../../context"
import { CREW_EDIT_STEP } from "../../../../store"
import DocumentAddDropdown from "./DocumentAddDropdown"
import { DocumentSyncStatusBadge } from "./DocumentSyncStatusBadge"
import { useDocumentListPolling } from "../hooks/useDocumentListPolling"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { RouteName } from "@/routes/constants"

// 文档类型常量
const DOCUMENT_TYPES = {
	LOCAL: "local",
	CUSTOM: "custom",
	PROJECT: "project",
	WIKI: "wiki",
} as const

function DocumentListPanel() {
	const { t } = useTranslation("crew/create")
	const navigate = useNavigate()
	const { id: crewId } = useParams<{ id: string }>()
	const [searchParams] = useSearchParams()
	const { knowledge } = useCrewEditStore()
	const [documentSearchQuery, setDocumentSearchQuery] = useState("")
	const [isSearchPending, setIsSearchPending] = useState(false)
	const latestSearchRequestIdRef = useRef(0)

	const knowledgeCode = searchParams.get("code") || ""
	const isSearching = documentSearchQuery.trim().length > 0
	const hasRetainedDocumentContext =
		knowledge.selectedDocumentCode !== null || knowledge.documentDetail !== null

	// 获取当前选中的知识库信息
	const currentKnowledge = useMemo(() => {
		return knowledge.knowledgeList.find((k) => k.code === knowledgeCode)
	}, [knowledge.knowledgeList, knowledgeCode])

	// 根据知识库类型决定新增按钮的行为
	const sourceType = currentKnowledge?.source_type

	/**
	 * 导航到重新绑定模式
	 */
	const navigateToRebindMode = useCallback(() => {
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewId },
			query: {
				panel: CREW_EDIT_STEP.KnowledgeBase,
				code: knowledgeCode,
				rebind: "true",
			},
		})
	}, [navigate, crewId, knowledgeCode])

	/**
	 * 导航到文档创建模式
	 */
	const navigateToDocumentCreate = useCallback(
		(type: string) => {
			navigate({
				name: RouteName.CrewEdit,
				params: { id: crewId },
				query: {
					panel: CREW_EDIT_STEP.KnowledgeBase,
					code: knowledgeCode,
					mode: "create",
					type,
				},
			})
		},
		[navigate, crewId, knowledgeCode],
	)

	/**
	 * 处理文档点击，更新 URL 和 store
	 */
	const handleDocumentClick = useCallback(
		(documentCode: string) => {
			// 更新 store
			knowledge.selectDocument(documentCode)

			// 更新 URL，添加 docCode 参数
			navigate({
				name: RouteName.CrewEdit,
				params: { id: crewId },
				query: {
					panel: CREW_EDIT_STEP.KnowledgeBase,
					code: knowledgeCode,
					docCode: documentCode,
				},
			})
		},
		[navigate, crewId, knowledgeCode, knowledge],
	)

	const docCount = knowledge.documentList.length
	/** 列表接口返回的文档总数（含未加载分页），与当前 Virtuoso 已加载条数 docCount 区分 */
	const documentListQueryTotal = knowledge.documentTotal

	// 文档列表轮询
	const { startPolling } = useDocumentListPolling({
		enabled: !!knowledgeCode && docCount > 0,
		documentList: knowledge.documentList,
		getDocumentList: () => knowledge.documentList,
		onFetchDocuments: async () => {
			if (knowledgeCode) {
				await knowledge.fetchDocumentList(
					knowledgeCode,
					documentSearchQuery || undefined,
					true, // reset
					true, // silent
					true, // skipAutoSelect - 轮询时不自动选中文档
					true, // preservePageRange - 保持已加载页面范围
				)
			}
		},
	})

	/**
	 * 处理新增按钮点击
	 * 根据知识库类型和是否已有文档决定是直接跳转还是显示菜单
	 */
	const handleAddButtonClick = useCallback(() => {
		if (!sourceType) return

		const hasExistingDocuments = docCount > 0

		// 类型 3：Project
		if (sourceType === CrewKnowledge.KnowledgeSourceType.PROJECT_FILE) {
			// 如果已有文档，跳转到重新绑定视图
			if (hasExistingDocuments) {
				navigateToRebindMode()
			} else {
				// 首次绑定，走正常创建流程
				navigateToDocumentCreate(DOCUMENT_TYPES.PROJECT)
			}
			return
		}

		// 类型 4：Enterprise Wiki
		if (sourceType === CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE) {
			// 如果已有文档，跳转到重新绑定视图
			if (hasExistingDocuments) {
				navigateToRebindMode()
			} else {
				// 首次绑定，走正常创建流程
				navigateToDocumentCreate(DOCUMENT_TYPES.WIKI)
			}
			return
		}

		// 类型 1：Documents - 显示菜单（通过 dropdown 处理）
		// 不需要额外处理，由 DocumentAddDropdown 组件控制
	}, [sourceType, docCount, navigateToRebindMode, navigateToDocumentCreate])

	/**
	 * 判断是否需要显示下拉菜单
	 * 仅当类型为 Documents 时显示菜单
	 */
	const shouldShowDropdown =
		sourceType === CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT ||
		sourceType === CrewKnowledge.KnowledgeSourceType.CUSTOM_CONTENT

	// 防抖搜索 - 300ms 延迟
	const { run: debouncedSearch } = useDebounceFn(
		async (searchValue: string, requestId: number) => {
			if (knowledgeCode) {
				// 搜索时重置分页状态
				knowledge.resetDocumentPagination()
				await knowledge.fetchDocumentList(knowledgeCode, searchValue || undefined)
			}

			if (latestSearchRequestIdRef.current === requestId) {
				setIsSearchPending(false)
			}
		},
		{ wait: 300 },
	)

	const handleSearchChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value
			const requestId = latestSearchRequestIdRef.current + 1
			latestSearchRequestIdRef.current = requestId
			setDocumentSearchQuery(value)
			setIsSearchPending(true)
			void debouncedSearch(value, requestId)
		},
		[debouncedSearch],
	)

	/**
	 * 处理滚动到底部，加载更多文档
	 */
	const handleEndReached = useCallback(() => {
		if (knowledge.documentHasMore && !knowledge.documentLoading && knowledgeCode) {
			void knowledge.loadMoreDocuments(knowledgeCode, documentSearchQuery || undefined)
		}
	}, [knowledge, knowledgeCode, documentSearchQuery])

	// 获取空状态描述文案的 key
	const getEmptyDescriptionKey = useCallback(() => {
		if (!sourceType) return "knowledgeDetail.addContentDesc"

		switch (sourceType) {
			case CrewKnowledge.KnowledgeSourceType.LOCAL_DOCUMENT:
			case CrewKnowledge.KnowledgeSourceType.CUSTOM_CONTENT:
				return "knowledgeDetail.addContentDescDocuments"
			case CrewKnowledge.KnowledgeSourceType.PROJECT_FILE:
				return "knowledgeDetail.addContentDescProject"
			case CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE:
				return "knowledgeDetail.addContentDescWiki"
			default:
				return "knowledgeDetail.addContentDesc"
		}
	}, [sourceType])

	const header = (
		<div className="flex shrink-0 items-center self-stretch pt-2">
			<p className="text-sm font-medium leading-none text-foreground">
				{t("knowledgeDetail.documentsTitle", { count: documentListQueryTotal })}
			</p>
		</div>
	)

	// 渲染新增按钮
	const renderAddButton = (buttonElement: React.ReactNode) => {
		if (shouldShowDropdown) {
			// 类型 1：显示下拉菜单
			return (
				<DocumentAddDropdown
					className="inline-flex"
					onLocalDocuments={() => navigateToDocumentCreate(DOCUMENT_TYPES.LOCAL)}
					onCustomContent={() => navigateToDocumentCreate(DOCUMENT_TYPES.CUSTOM)}
				>
					{buttonElement}
				</DocumentAddDropdown>
			)
		}

		// 类型 3 和 4：直接触发点击
		return (
			<span className="inline-flex" onClick={handleAddButtonClick}>
				{buttonElement}
			</span>
		)
	}

	if (
		knowledge.documentLoading &&
		docCount === 0 &&
		!isSearching &&
		!isSearchPending &&
		!hasRetainedDocumentContext
	) {
		return (
			<div className="flex h-full min-h-0 flex-col gap-2">
				{header}
				<div className="flex min-h-0 flex-1 items-center justify-center">
					<Spinner className="animate-spin" size={16} />
				</div>
			</div>
		)
	}

	if (
		docCount === 0 &&
		!isSearching &&
		!knowledge.documentLoading &&
		!isSearchPending &&
		!hasRetainedDocumentContext
	) {
		return (
			<div className="flex h-full min-h-0 flex-col gap-2">
				{header}
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
					<FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
					<div className="text-center">
						<p className="text-sm font-medium text-foreground">
							{t("knowledgeDetail.noDocumentsYet")}
						</p>
						<p className="mt-2 text-xs text-muted-foreground">
							{t(getEmptyDescriptionKey())}
						</p>
					</div>
					{renderAddButton(
						<Button type="button" data-testid="knowledge-document-add-content-trigger">
							<CirclePlus className="mr-2 h-4 w-4" aria-hidden />
							{t("knowledgeDetail.addContentButton")}
						</Button>,
					)}
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-2">
			{header}
			<div className="flex shrink-0 items-center gap-1">
				<div className="relative min-w-0 flex-1">
					<Search
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden
					/>
					<Input
						type="search"
						value={documentSearchQuery}
						onChange={handleSearchChange}
						placeholder={t("knowledgeDetail.searchPlaceholder")}
						className="h-9 rounded-lg pl-9 shadow-xs"
						data-testid="knowledge-document-list-search"
					/>
				</div>
				{renderAddButton(
					<Button
						type="button"
						size="icon"
						className="size-9 shrink-0 rounded-lg shadow-xs"
						aria-label={t("knowledgeDetail.addContentButton")}
						data-testid="knowledge-document-list-add-trigger"
					>
						<CirclePlus className="size-4" aria-hidden />
					</Button>,
				)}
			</div>
			{knowledge.documentList.length === 0 ? (
				<div className="flex min-h-0 flex-1 items-center justify-center">
					{knowledge.documentLoading || isSearchPending ? (
						<Spinner className="animate-spin" size={16} />
					) : isSearching ? (
						<p className="px-3 py-2 text-sm text-muted-foreground">
							{t("knowledgeDetail.noSearchResults")}
						</p>
					) : null}
				</div>
			) : (
				<div className="min-h-0 flex-1">
					<Virtuoso
						data={knowledge.documentList}
						endReached={handleEndReached}
						itemContent={(index, doc) => (
							<div className="px-0.5 py-0.5">
								{/*
									MagicEllipseWithTooltip 用 title 作 Tooltip 内容；传入的 title 会落到 div 上只是原生 title，Ant Design 提示无效。
									省略与气泡应对「纯文本」用 text，整行包进去会导致 flex+多子节点无法正确检测 overflow。Badge 放外侧避免挡住重试点击。
								 */}
								<div
									role="button"
									tabIndex={0}
									onClick={() => handleDocumentClick(doc.code)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault()
											handleDocumentClick(doc.code)
										}
									}}
									className={`flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
										knowledge.selectedDocumentCode === doc.code
											? "bg-muted font-medium"
											: "text-muted-foreground"
									}`}
								>
									<div className="min-w-0 flex-1">
										<MagicEllipseWithTooltip
											className="min-w-0"
											placement="right"
											text={doc.name}
										/>
									</div>
									<DocumentSyncStatusBadge
										syncStatus={doc.sync_status}
										documentCode={doc.code}
										knowledgeBaseCode={knowledgeCode}
										onRetrySuccess={async () => {
											if (!knowledgeCode) return
											await knowledge.fetchDocumentList(
												knowledgeCode,
												documentSearchQuery || undefined,
												false,
												true,
												true,
												true,
											)
											startPolling()
										}}
										className="shrink-0"
									/>
								</div>
							</div>
						)}
						components={{
							Footer: () =>
								knowledge.documentHasMore && knowledge.documentLoading ? (
									<div className="flex items-center justify-center px-3 py-3">
										<Spinner className="animate-spin" size={16} />
									</div>
								) : null,
						}}
						style={{ height: "100%" }}
					/>
				</div>
			)}
		</div>
	)
}

export default observer(DocumentListPanel)

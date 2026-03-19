import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import { Flex, Input, Button, Spin } from "antd"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { useVectorKnowledgeRecallTestStyles } from "./styles"
import { KnowledgeApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import { getExternalFileIconByType } from "@/pages/vectorKnowledge/constant"
import { IconLayoutList } from "@tabler/icons-react"
import LoadingOutlined from "@/components/icons/LoadingOutlined"
import magicToast from "@/components/base/MagicToaster/utils"

interface Props {
	knowledgeBaseCode: string
}

interface RecallRecord {
	key: string
	testTime: string
	testText: string
}

export default function RecallTest({ knowledgeBaseCode }: Props) {
	const { styles } = useVectorKnowledgeRecallTestStyles()
	const { t } = useTranslation("flow")

	// 测试文本
	const [testText, setTestText] = useState("")
	// 测试记录
	const [records, setRecords] = useState<RecallRecord[]>([])
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
			magicToast.warning(t("knowledgeDatabase.inputSourceTextPlaceholder"))
			return
		}

		setRecallLoading(true)
		try {
			const res = await KnowledgeApi.recallTest({
				knowledge_code: knowledgeBaseCode,
				query: testText,
			})
			if (res && res.list) {
				setResults({
					total: res.total,
					list: res.list,
				})
			}
			magicToast.success(t("knowledgeDatabase.testSuccess"))
		} catch (error) {
			console.error("测试失败:", error)
			magicToast.error(t("knowledgeDatabase.testFailed"))
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

	// 获取测试记录
	useEffect(() => {
		if (knowledgeBaseCode) {
			// 模拟获取测试记录
			const mockRecords: RecallRecord[] = [
				{
					key: "1",
					testTime: "2025-03-25 07:30",
					testText: "服务",
				},
				{
					key: "2",
					testTime: "2025-03-25 07:02",
					testText: "技术服务",
				},
			]
			setRecords(mockRecords)
		}
	}, [knowledgeBaseCode])

	// 表格列定义
	const columns = [
		{
			title: t("knowledgeDatabase.testTime"),
			dataIndex: "testTime",
			key: "testTime",
			width: 200,
		},
		{
			title: t("knowledgeDatabase.testText"),
			dataIndex: "testText",
			key: "testText",
		},
	]

	return (
		<Flex gap={20} className={styles.container}>
			{/* 左侧面板 - 测试输入和历史记录 */}
			<div className={styles.leftPanel}>
				<div className={styles.title}>{t("knowledgeDatabase.recallTest")}</div>
				<div className={styles.description}>{t("knowledgeDatabase.recallTestDesc")}</div>
				<div className={styles.inputSection}>
					<div className={styles.sectionTitle}>{t("knowledgeDatabase.sourceText")}</div>
					<div className={styles.textAreaContainer}>
						<Input.TextArea
							className={styles.textArea}
							rows={6}
							value={testText}
							onChange={handleTextChange}
							placeholder={t("knowledgeDatabase.inputSourceTextPlaceholder")}
						/>
					</div>
					<Flex justify="flex-end" className={styles.testButtonContainer}>
						<Button
							className={styles.testButton}
							type="primary"
							onClick={debouncedHandleTest}
							disabled={recallLoading}
						>
							{t("knowledgeDatabase.test")}
						</Button>
					</Flex>
				</div>

				{/* <div className={styles.recentTitle}>{t("knowledgeDatabase.recentTests")}</div>
				<Table
					className={styles.recordTable}
					columns={columns}
					dataSource={records}
					pagination={false}
					bordered={false}
					size="small"
				/> */}
			</div>

			{/* 右侧面板 - 测试结果 */}
			<Flex vertical className={styles.rightPanel}>
				<Flex align="center" gap={4} className={styles.resultsHeader}>
					<IconLayoutList size={16} color="currentColor" />
					{t("knowledgeDatabase.recallParagraphs", { num: results.total })}
				</Flex>

				<div className={styles.resultsContent}>
					{recallLoading ? (
						<Flex
							vertical
							justify="center"
							align="center"
							className={styles.resultsLoading}
						>
							<Spin indicator={<LoadingOutlined spin />} size="large" />
							<div className={styles.resultsLoadingText}>
								{t("knowledgeDatabase.recallTestLoading")}
							</div>
						</Flex>
					) : (
						<>
							{results.list.length > 0 ? (
								results.list.map((item) => (
									<div key={item.id} className={styles.item}>
										<Flex align="center" gap={4} className={styles.itemHeader}>
											<IconLayoutList size={16} color="currentColor" />
											<div>{t("knowledgeDatabase.segment")}</div>
											<div>/</div>
											<div>
												{t("knowledgeDatabase.segmentWordCount", {
													num: item.word_count,
												})}
											</div>
											<div>/</div>
											<div>Score</div>
											<div>
												{typeof item.score === "number"
													? item.score.toFixed(2)
													: "**"}
											</div>
										</Flex>
										<div className={styles.itemContent}>{item.content}</div>
										<Flex
											align="center"
											gap={6}
											className={styles.itemFileInfo}
										>
											{getExternalFileIconByType(item.document_type, 18)}
											{item.document_name}
										</Flex>
									</div>
								))
							) : (
								<Flex justify="center" align="center" className={styles.empty}>
									{t("knowledgeDatabase.noResults")}
								</Flex>
							)}
						</>
					)}
				</div>
			</Flex>
		</Flex>
	)
}

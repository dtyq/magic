import { IconCircleCheck, IconCircleX, IconAlertCircle } from "@tabler/icons-react"
import { Flex, Spin } from "antd"
import { useState, useEffect, useRef } from "react"
import LoadingOutlined from "@/components/icons/LoadingOutlined"
import useNavigate from "@/routes/hooks/useNavigate"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { documentSyncStatusMap } from "../../constant"
import { useVectorKnowledgeEmbedStyles } from "./styles"
import { KnowledgeApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import KnowledgeContent from "./components/KnowledgeContent"
import LoadingState from "./components/LoadingState"
import { RouteName } from "@/routes/constants"

interface VectorKnowledgeEmbedProps {
	knowledgeBaseCode: string
}

export default function VectorKnowledgeEmbed({ knowledgeBaseCode }: VectorKnowledgeEmbedProps) {
	const { styles } = useVectorKnowledgeEmbedStyles()
	const { t } = useTranslation("flow")
	const navigate = useNavigate()

	/** 知识库详情 */
	const [createdKnowledge, setCreatedKnowledge] = useState<Knowledge.Detail>()
	/** 是否嵌入完成 */
	const [isEmbed, setIsEmbed] = useState(false)
	/** 知识库文档列表 */
	const [documentList, setDocumentList] = useState<Knowledge.EmbedDocumentDetail[]>([])
	/** 轮询定时器引用 */
	const timerRef = useRef<NodeJS.Timeout | null>(null)
	/** 数据是否已加载 */
	const [isLoading, setIsLoading] = useState(true)

	/** 查看知识库 - 跳转至详情页 */
	const handleViewKnowledge = useMemoizedFn(() => {
		navigate({
			name: RouteName.VectorKnowledgeDetail,
			query: { code: knowledgeBaseCode },
		})
	})

	/** 获取文档同步状态图标 */
	const getStatusIcon = (syncStatus: documentSyncStatusMap) => {
		switch (syncStatus) {
			case documentSyncStatusMap.Pending:
			case documentSyncStatusMap.Processing:
				return <Spin indicator={<LoadingOutlined spin />} />
			case documentSyncStatusMap.Success:
				return <IconCircleCheck className={styles.icon} color="#32C436" size={24} />
			case documentSyncStatusMap.Failed:
				return <IconCircleX color="#FF4D4F" size={24} />
		}
	}

	/** 更新知识库文档列表的嵌入状态 */
	const updateKnowledgeDocumentList = useMemoizedFn(async () => {
		try {
			const res = await KnowledgeApi.getKnowledgeDocumentList({
				code: knowledgeBaseCode,
			})
			if (res) {
				setDocumentList(res.list)
				setIsEmbed(
					res.list.length > 0 &&
					res.list.every(
						(item: Knowledge.EmbedDocumentDetail) =>
							![
								documentSyncStatusMap.Pending,
								documentSyncStatusMap.Processing,
							].includes(item.sync_status),
					),
				)
			}
		} catch (error) {
			console.error("Failed to get document list:", error)
		}
	})

	/**
	 * 更新知识库详情
	 */
	const getKnowledgeDetail = useMemoizedFn(async (code: string) => {
		try {
			const res = await KnowledgeApi.getKnowledgeDetail(code)
			if (res) {
				setCreatedKnowledge(res)
				setIsLoading(false) // 数据加载完成
			}
		} catch (error) {
			console.error("获取知识库详情失败", error)
			setIsLoading(false) // 即使出错也标记为加载完成
		}
	})

	// 获取知识库详情
	useEffect(() => {
		if (knowledgeBaseCode) {
			getKnowledgeDetail(knowledgeBaseCode)
		}
	}, [knowledgeBaseCode])

	/** 开始轮询 */
	const startPolling = useMemoizedFn(() => {
		// 随机2-5秒
		const randomTime = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000
		timerRef.current = setTimeout(async () => {
			await updateKnowledgeDocumentList()
			// 如果还没嵌入完成，继续轮询
			if (!isEmbed) {
				startPolling()
			}
		}, randomTime)
	})

	/** 停止轮询 */
	const stopPolling = useMemoizedFn(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = null
		}
	})

	// 组件挂载时开始轮询，组件卸载或isEmbed为true时停止轮询
	useEffect(() => {
		// 初始调用一次接口
		updateKnowledgeDocumentList()
		// 开始轮询
		startPolling()

		// 组件卸载时清除定时器
		return () => {
			stopPolling()
		}
	}, [])

	// 当isEmbed状态变为true时，停止轮询
	useEffect(() => {
		if (isEmbed) {
			stopPolling()
		}
	}, [isEmbed])

	return (
		<Flex vertical justify="space-between" className={styles.container}>
			{isLoading ? (
				<LoadingState />
			) : createdKnowledge ? (
				<KnowledgeContent
					createdKnowledge={createdKnowledge}
					documentList={documentList}
					isEmbed={isEmbed}
					handleViewKnowledge={handleViewKnowledge}
					getStatusIcon={getStatusIcon}
				/>
			) : (
				<div className={styles.error}>
					<IconAlertCircle color="#FF4D4F" size={36} />
					<div>{t("knowledgeDatabase.loadError")}</div>
				</div>
			)}
		</Flex>
	)
}

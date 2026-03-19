import React, { useState, useEffect } from "react"
import { Checkbox, Flex, Input, Spin } from "antd"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import IconNoData from "@/components/icons/IconNoData"
import { useVectorKnowledgeCreateStyles } from "../styles"
import SmartBreadcrumb, { type BreadcrumbItem } from "./SmartBreadcrumb"
import { KnowledgeApi } from "@/apis"
import { useMemoizedFn, useDebounceFn } from "ahooks"
import { Knowledge } from "@/types/knowledge"
import { IconChevronRight, IconSearch, IconTrash } from "@tabler/icons-react"
import IconEnterpriseKnowledge from "@/enhance/tabler/icons-react/icons/IconEnterpriseKnowledge"
import IconEnterpriseCloudDisk from "@/enhance/tabler/icons-react/icons/IconEnterpriseCloudDisk"
import IconPersonalCloudDisk from "@/enhance/tabler/icons-react/icons/IconPersonalCloudDisk"
import EllipsisTooltip from "./EllipsisTooltip"
import { getTeamshareFileIcon } from "@/pages/vectorKnowledge/constant"
import MagicAvatar from "@/components/base/MagicAvatar"

interface EnterpriseKnowledgeProps {
	showHeader?: boolean
	selectedFiles: Knowledge.TeamshareFileCascadeItem[]
	setSelectedFiles: React.Dispatch<React.SetStateAction<Knowledge.TeamshareFileCascadeItem[]>>
}

export default function EnterpriseKnowledge({
	showHeader = true,
	selectedFiles,
	setSelectedFiles,
}: EnterpriseKnowledgeProps) {
	const { styles } = useVectorKnowledgeCreateStyles()
	const { t } = useTranslation("flow")

	/** 搜索值 */
	const [searchValue, setSearchValue] = useState("")
	const handleSearch = (value: string) => {
		setSearchValue(value)
	}

	// 面包屑当前路径状态
	const [currentPath, setCurrentPath] = useState<BreadcrumbItem[]>([])
	// 当前展示的文档/目录
	const [currentFiles, setCurrentFiles] = useState<Knowledge.TeamshareFileCascadeItem[]>([])
	// 请求loading
	const [loading, setLoading] = useState(false)

	// 构建导航路径
	const buildPath = (itemId: string) => {
		const index = currentPath.findIndex((item) => item.id === itemId)
		if (index === -1) {
			return []
		}
		const path = currentPath.slice(0, index + 1)

		return path
	}

	// 处理面包屑的目录点击
	const handleDirectoryClick = (itemId: string) => {
		setSearchValue("")
		if (!itemId) {
			// 处理根目录点击
			setCurrentPath([])
			return
		}
		const newPath = buildPath(itemId)
		setCurrentPath(newPath)
	}

	/** 搜索天书文件 */
	const { run: searchTeamshareFile } = useDebounceFn(
		async (keyword: string) => {
			if (keyword) {
				try {
					setLoading(true)
					const res = await KnowledgeApi.searchTeamshareFiles({ keyword })
					if (res) {
						setCurrentFiles(res)
					}
				} catch (error) {
					console.error(error)
				} finally {
					setLoading(false)
				}
			} else if (currentPath.length > 0) {
				const parentId = currentPath[currentPath.length - 1].id
				const spaceType = currentPath[currentPath.length - 1].spaceType
				getFileCascade(parentId, spaceType)
			}
		},
		{ wait: 500 },
	)

	/** 获取天书文件目录 */
	const getFileCascade = useMemoizedFn(
		async (parent_id: string, space_type: Knowledge.SpaceType) => {
			try {
				setLoading(true)
				const res = await KnowledgeApi.getTeamshareFileCascade({
					space_type,
					parent_id,
				})
				setCurrentFiles(res.items)
			} catch (error) {
				console.error(error)
			} finally {
				setLoading(false)
			}
		},
	)

	/** 点击文件/目录 */
	const handleFileClick = useMemoizedFn(
		(
			itemId: string,
			spaceType: Knowledge.SpaceType,
			name: string,
			fileType: Knowledge.TeamshareFileCascadeItemFileType,
			path?: Knowledge.TeamshareFileCascadeItem["path"],
		) => {
			// 当前版本限制：已选择的目录无法再进入下一层
			if (
				fileType === Knowledge.TeamshareFileCascadeItemFileType.FOLDER &&
				selectedFiles.every((file) => file.id !== itemId)
			) {
				setSearchValue("")
				setCurrentPath(
					path
						? path.map((item) => ({
							id: item.id,
							name: item.name,
							spaceType: item.space_type,
						}))
						: [...currentPath, { id: itemId, name, spaceType }],
				)
			}
		},
	)

	/** 选择文件/目录 */
	const handleFileSelect = (item: Knowledge.TeamshareFileCascadeItem, checked: boolean) => {
		if (checked) {
			const notChildrenFiles = selectedFiles.filter((file) =>
				file.path.every((path) => path.id !== item.id),
			)
			setSelectedFiles([...notChildrenFiles, item])
		} else {
			setSelectedFiles(selectedFiles.filter((file) => file.id !== item.id))
		}
	}

	/** 删除已选文件/目录 */
	const handleFileDelete = useMemoizedFn((id: string) => {
		setSelectedFiles(selectedFiles.filter((file) => file.id !== id))
	})

	useEffect(() => {
		if (currentPath.length > 0) {
			const parentId = currentPath[currentPath.length - 1].id
			const spaceType = currentPath[currentPath.length - 1].spaceType
			getFileCascade(parentId, spaceType)
		}
	}, [currentPath])

	useEffect(() => {
		searchTeamshareFile(searchValue)
	}, [searchValue])

	// 默认根目录
	const defaultDirectory = [
		{
			id: "0",
			name: t("common.privateDrive"),
			spaceType: Knowledge.SpaceType.OWN,
			icon: <IconPersonalCloudDisk size={14} />,
		},
		{
			id: "0",
			name: t("common.enterpriseDrive"),
			spaceType: Knowledge.SpaceType.SHARE,
			icon: <IconEnterpriseCloudDisk size={14} />,
		},
		{
			id: "0",
			name: t("common.teamshareKnowledgeDatabase"),
			spaceType: Knowledge.SpaceType.KNOWLEDGE_BASE_SHARE,
			icon: <IconEnterpriseKnowledge size={14} />,
		},
	]

	return (
		<>
			{showHeader && (
				<Flex align="center" justify="space-between">
					<div className={cx(styles.label, styles.required)}>
						{t("knowledgeDatabase.bindEnterpriseKnowledgeLabel")}
					</div>
					<div className={styles.enterpriseKnowledgedesc}>
						{t("knowledgeDatabase.bindEnterpriseKnowledgeDesc")}
					</div>
				</Flex>
			)}
			<div className={styles.enterpriseContainer}>
				<div className={styles.enterpriseLeft}>
					<div className={styles.enterpriseLeftHeader}>
						<Input
							placeholder={t(
								"knowledgeDatabase.enterpriseKnowledgeSearchPlaceholder",
							)}
							prefix={<IconSearch size={16} />}
							value={searchValue}
							onChange={(e) => handleSearch(e.target.value)}
						/>
					</div>
					<div className={styles.enterpriseLeftContent}>
						{currentPath.length === 0 && !searchValue ? (
							<>
								{defaultDirectory.map((item) => (
									<div
										key={item.name}
										className={styles.enterpriseLeftFile}
										onClick={() =>
											handleFileClick(
												item.id,
												item.spaceType,
												item.name,
												Knowledge.TeamshareFileCascadeItemFileType.FOLDER,
											)
										}
										style={{ cursor: "pointer" }}
									>
										<div className={styles.enterpriseLeftFileContent}>
											<div className={styles.enterpriseLeftFileTitleWrapper}>
												<div className={styles.enterpriseFileIcon}>
													{item.icon}
												</div>
												<div className={styles.enterpriseFileTitle}>
													{item.name}
												</div>
											</div>
											<IconChevronRight
												size={16}
												color="rgba(28, 29, 35, 0.6)"
											/>
										</div>
									</div>
								))}
							</>
						) : (
							<>
								{!searchValue && (
									<SmartBreadcrumb
										rootName={t("knowledgeDatabase.select")}
										path={currentPath}
										onItemClick={handleDirectoryClick}
									/>
								)}
								{loading && (
									<div className={styles.enterpriseLeftLoading}>
										<Spin />
										<div className={styles.enterpriseLeftLoadingText}>
											{t("knowledgeDatabase.loading")}
										</div>
									</div>
								)}
								{!loading && (
									<Flex vertical gap={4}>
										{currentFiles.length > 0 ? (
											currentFiles.map((item) => (
												<div
													key={item.id}
													className={styles.enterpriseLeftFile}
												>
													<Checkbox
														checked={selectedFiles.some(
															(file) => file.id === item.id,
														)}
														onChange={(v) =>
															handleFileSelect(item, v.target.checked)
														}
														disabled={!item.can_parse_content}
													/>
													<div
														className={cx(
															styles.enterpriseLeftFileContent,
															{
																[styles.enterpriseLeftFileContentSelected]:
																	selectedFiles.some(
																		(file) =>
																			file.id === item.id,
																	),
															},
														)}
														onClick={() =>
															handleFileClick(
																item.id,
																item.space_type,
																item.name,
																item.file_type,
																item.path,
															)
														}
													>
														<div
															className={
																styles.enterpriseLeftFileTitleWrapper
															}
														>
															<div
																className={
																	styles.enterpriseFileIcon
																}
															>
																{getTeamshareFileIcon(
																	item.file_type,
																)}
															</div>
															<EllipsisTooltip
																title={item.name}
																placement="topLeft"
															>
																<div
																	className={
																		styles.enterpriseFileTitle
																	}
																>
																	{item.name}
																</div>
															</EllipsisTooltip>
														</div>
														<div
															className={
																styles.enterpriseLeftFileInfo
															}
														>
															<Flex gap={6} align="center">
																<MagicAvatar
																	className={
																		styles.enterpriseLeftFileAvatar
																	}
																	src={item.creator.avatar}
																	size={18}
																>
																	{item.creator.real_name}
																</MagicAvatar>
																<EllipsisTooltip
																	title={item.creator.real_name}
																	placement="topLeft"
																>
																	<div
																		className={
																			styles.enterpriseLeftFileCreatorName
																		}
																	>
																		{item.creator.real_name}
																	</div>
																</EllipsisTooltip>
															</Flex>
															{item.file_type ===
																Knowledge
																	.TeamshareFileCascadeItemFileType
																	.FOLDER && (
																	<IconChevronRight
																		size={16}
																		color="rgba(28, 29, 35, 0.6)"
																	/>
																)}
														</div>
													</div>
												</div>
											))
										) : (
											<div className={styles.enterpriseEmpty}>
												<IconNoData />
												<div>{t("knowledgeDatabase.emptyData")}</div>
											</div>
										)}
									</Flex>
								)}
							</>
						)}
					</div>
				</div>
				<div className={styles.enterpriseRight}>
					<div className={styles.enterpriseRightHeader}>
						{t("knowledgeDatabase.selectedCount", { count: selectedFiles.length })}
					</div>
					{selectedFiles.length > 0 ? (
						<div className={styles.enterpriseRightContent}>
							{selectedFiles.map((item) => (
								<div key={item.id} className={styles.enterpriseRightFile}>
									<Flex align="center" gap={6}>
										<div className={styles.enterpriseFileIcon}>
											{getTeamshareFileIcon(item.file_type)}
										</div>
										<div className={styles.enterpriseFileTitle}>
											{item.name}
										</div>
									</Flex>
									<div
										className={styles.enterpriseRightFileTrash}
										onClick={() => handleFileDelete(item.id)}
									>
										<IconTrash size={20} />
									</div>
								</div>
							))}
						</div>
					) : (
						<div className={styles.enterpriseEmpty}>
							<IconNoData />
							<div>{t("knowledgeDatabase.emptyData")}</div>
						</div>
					)}
				</div>
			</div>
		</>
	)
}

import { useStyles } from "./styles"
import MagicSpin from "@/components/base/MagicSpin"
import { useDebounceFn, useMemoizedFn, useMount } from "ahooks"
import { useState } from "react"
import MCPCard, { useMCPCard } from "./components/MCPCard"
import Drawer from "./components/Drawer"
import MCPPanel from "./components/MCPPanel"
import { Input, Button, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { IconSearch } from "@tabler/icons-react"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import { MCPForm } from "@/components/Agent/MCP"
import InfiniteScroll from "react-infinite-scroll-component"

export default function MCP() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")

	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")

	const [selected, setSelected] = useState("")

	const handleDeletedCallback = useMemoizedFn((id: string) => {
		if (selected === id) {
			setSelected("")
			setOpen(false)
		}
	})

	const {
		mcpList,
		loading,
		getMcpList,
		mcpListRefresh,
		onEdit,
		onDelete,
		onStatusChange,
		loadMoreData,
		hasMore,
		total,
	} = useMCPCard({
		onDeletedCallback: handleDeletedCallback,
	})

	const onClick = useMemoizedFn((mcp) => {
		setSelected(mcp?.id)
		setOpen(true)
	})

	const { run: onSearchChange } = useDebounceFn(
		(event) => {
			const value = event.target.value
			setSearchValue(value)
			mcpListRefresh(value)
		},
		{ wait: 500 },
	)

	const handleLoadMore = useMemoizedFn(() => {
		loadMoreData(searchValue)
	})

	useMount(() => {
		getMcpList({ page: 1, pageSize: 12, name: "" })
	})

	return (
		<Flex className={styles.page}>
			<Flex vertical flex={1} className={styles.layout}>
				<Flex justify="space-between" className={styles.header}>
					<span className={styles.headerTitle}>
						{t("mcp.page.title")}（{total || 0}）
					</span>
					<div className={styles.menu}>
						<Input
							onChange={onSearchChange}
							prefix={<IconSearch size={20} />}
							placeholder={t("mcp.page.search.input")}
						/>
						<Button
							type="primary"
							onClick={() => {
								openAgentCommonModal({
									width: 600,
									footer: null,
									closable: false,
									children: (
										<MCPForm
											onSuccessCallback={() => mcpListRefresh(searchValue)}
										/>
									),
								})
							}}
						>
							{t("mcp.page.create")}
						</Button>
					</div>
				</Flex>
				<MagicSpin
					delay={500}
					spinning={loading && mcpList.length === 0}
					className={styles.loading}
					innerClassName={styles.loadingInner}
				>
					<div id="mcpScrollableDiv" className={styles.container}>
						{mcpList.length > 0 ? (
							<InfiniteScroll
								dataLength={mcpList.length}
								next={handleLoadMore}
								hasMore={hasMore}
								loader={
									<Flex
										align="center"
										justify="center"
										className={styles.emptyTips}
									>
										{t("loading", { ns: "flow" })}
									</Flex>
								}
								endMessage={
									<Flex
										align="center"
										justify="center"
										className={styles.emptyTips}
									>
										————— {t("common.comeToTheEnd", { ns: "flow" })} —————
									</Flex>
								}
								scrollableTarget="mcpScrollableDiv"
							>
								<div className={styles.scroll}>
									{mcpList.map((item) => (
										<MCPCard
											key={item.id}
											item={item}
											selected={selected === item.id}
											className={cx(styles.card)}
											onEdit={onEdit}
											onDelete={onDelete}
											onClick={onClick}
											onStatusChange={onStatusChange}
										/>
									))}
								</div>
							</InfiniteScroll>
						) : (
							!loading && (
								<div className={styles.emptyContainer}>
									<div className={styles.emptyTips}>{t("mcp.empty")}</div>
								</div>
							)
						)}
					</div>
				</MagicSpin>
			</Flex>
			<Drawer
				open={open}
				onClose={() => {
					setOpen(false)
					setSelected("")
				}}
			>
				<MCPPanel id={selected} onSuccessCallback={() => mcpListRefresh(searchValue)} />
			</Drawer>
		</Flex>
	)
}

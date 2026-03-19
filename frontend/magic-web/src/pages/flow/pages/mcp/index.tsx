import { useStyles } from "./styles"
import MagicScrollBar from "@/components/base/MagicScrollBar"
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

export default function MCP() {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")

	const [open, setOpen] = useState(false)

	const [selected, setSelected] = useState("")

	const handleDeletedCallback = useMemoizedFn((id: string) => {
		if (selected === id) {
			setSelected("")
			setOpen(false)
		}
	})

	const { mcpList, loading, getMcpList, mcpListRefresh, onEdit, onDelete, onStatusChange } =
		useMCPCard({
			onDeletedCallback: handleDeletedCallback,
		})

	const onClick = useMemoizedFn((mcp) => {
		setSelected(mcp?.id)
		setOpen(true)
	})

	const { run: onSearchChange } = useDebounceFn(
		(event) => {
			getMcpList({ page: 1, pageSize: 100, name: event.target.value })
		},
		{ wait: 500 },
	)

	useMount(() => {
		getMcpList({ page: 1, pageSize: 100, name: "" })
	})

	return (
		<Flex className={styles.page}>
			<Flex vertical flex={1} className={styles.layout}>
				<Flex justify="space-between" className={styles.header}>
					<span className={styles.headerTitle}>
						{t("mcp.page.title")}（{mcpList?.length || 0}）
					</span>
					<div className={styles.menu}>
						{/* <Select style={{ width: 120, flex: "none" }}>
							<Select.Option>全部</Select.Option>
							<Select.Option>工具</Select.Option>
							<Select.Option>SSE</Select.Option>
							<Select.Option>HTTP</Select.Option>
							<Select.Option>STDIO</Select.Option>
						</Select> */}
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
									children: <MCPForm onSuccessCallback={mcpListRefresh} />,
								})
							}}
						>
							{t("mcp.page.create")}
						</Button>
					</div>
				</Flex>
				<MagicSpin delay={500} spinning={loading} className={styles.loading}>
					<MagicScrollBar className={styles.container} autoHide={false}>
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
						<Flex align="center" justify="center" className={styles.emptyTips}>
							————— {t("common.comeToTheEnd", { ns: "flow" })} —————
						</Flex>
					</MagicScrollBar>
				</MagicSpin>
			</Flex>
			<Drawer
				open={open}
				onClose={() => {
					setOpen(false)
					setSelected("")
				}}
			>
				<MCPPanel id={selected} onSuccessCallback={mcpListRefresh} />
			</Drawer>
		</Flex>
	)
}

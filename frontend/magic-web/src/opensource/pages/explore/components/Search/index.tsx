import { memo, useState } from "react"
import { Flex, Select } from "antd"
import { useTranslation } from "react-i18next"
import { IconChevronRight, IconSearch } from "@tabler/icons-react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import type { Bot } from "@/opensource/types/bot"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import { resolveToString } from "@dtyq/es6-template-strings"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import VirtualList from "rc-virtual-list"
import { BotApi } from "@/opensource/apis"
import useStyles from "./styles"
import PromptCard from "../PromptCard"

const Search = memo(({ handleClickCard }: { handleClickCard: (id: string) => void }) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()

	const [active, setActive] = useState<string>()
	const [open, setOpen] = useState(false)
	const [searchResult, setSearchResult] = useState<Bot.OrgBotItem[]>([])
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(false)

	const [keyword, setKeyword] = useState<string>("")

	const { run: debounceSearch } = useDebounceFn(
		useMemoizedFn(async (searchKeyword: string) => {
			if (searchKeyword) {
				setKeyword(searchKeyword)
				if (loading) return

				setLoading(true)
				try {
					const res = await BotApi.getOrgBotList({ keyword: searchKeyword })
					if (keyword === searchKeyword) {
						setSearchResult((prev) => [...prev, ...res.list])
						setHasMore(res.total > searchResult.length + res.list.length)
					} else {
						setSearchResult(res.list)
						setHasMore(res.total > res.list.length)
					}
				} finally {
					setLoading(false)
				}
			} else {
				// 清空关键词时，确保完全重置搜索结果
				setSearchResult([])
				setKeyword("")
				setHasMore(false)
			}
		}),
		{
			wait: 300,
		},
	)

	const loadMore = useMemoizedFn(() => {
		if (!keyword || loading || !hasMore) return
		debounceSearch(keyword)
	})

	const onScroll = useMemoizedFn((e: React.UIEvent<HTMLElement, UIEvent>) => {
		if (loading || !hasMore) return

		const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
		if (scrollHeight - scrollTop - clientHeight <= 50) {
			loadMore()
		}
	})

	return (
		<Flex className={styles.searchGroup}>
			<MagicIcon
				component={IconSearch}
				size={24}
				color={colorUsages.text[3]}
				className={styles.searchIcon}
			/>
			<Select
				showSearch
				className={styles.search}
				placeholder={t("explore.searchFriend")}
				defaultActiveFirstOption={false}
				filterOption={false}
				suffixIcon={null}
				onSearch={debounceSearch}
				notFoundContent={<MagicEmpty />}
				popupClassName={styles.searchPopup}
				open={open}
				onDropdownVisibleChange={(visible) => {
					setOpen(visible)
				}}
				dropdownRender={() => {
					return (
						<Flex
							vertical
							gap={8}
							onMouseDown={(e) => {
								e.preventDefault()
								e.stopPropagation()
							}}
						>
							{searchResult.length > 0 && (
								<>
									<div>
										{resolveToString(t("explore.searchResult"), {
											num: searchResult.length,
										})}
									</div>
									<VirtualList
										data={searchResult}
										itemKey="id"
										itemHeight={80}
										height={500}
										onScroll={onScroll}
										data-testid="virtual-list"
										className={styles.searchList}
									>
										{(option) => (
											<Flex
												justify="space-between"
												className={cx(styles.searchOption, {
													[styles.searchOptionActive]:
														option.id === active,
												})}
												align="center"
												gap={8}
												key={option.id}
												onClick={() => setActive(option.id)}
											>
												<PromptCard
													onClick={handleClickCard}
													data={{
														id: option.id,
														title: option.robot_name,
														icon: option.robot_avatar,
														description: option.robot_description,
													}}
													textGap4
												/>
												<MagicIcon component={IconChevronRight} size={24} />
											</Flex>
										)}
									</VirtualList>
								</>
							)}
							{searchResult.length === 0 && <MagicEmpty />}
						</Flex>
					)
				}}
			/>
		</Flex>
	)
})

export default Search

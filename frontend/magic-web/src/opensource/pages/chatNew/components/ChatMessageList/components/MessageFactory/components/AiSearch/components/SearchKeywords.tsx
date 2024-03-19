import { useUpdateEffect } from "ahooks"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { memo, useRef, useState } from "react"

interface SearchKeywordsProps {
	items?: string[] | null
	collapsed?: boolean
}

const useStyles = createStyles(({ css, token }) => ({
	searchKeyword: css`
		border-radius: 100px;
		background: ${token.magicColorUsages.fill[1]};
		display: flex;
		padding: 4px 12px;
		justify-content: center;
		align-items: center;
		gap: 10px;
		cursor: default;

		color: ${token.colorTextTertiary};
		text-align: justify;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;

		@keyframes keyword-enter {
			0% {
				display: none;
				opacity: 0;
				transform: translateY(100%);
			}
			100% {
				display: block;
				opacity: 1;
				transform: translateY(0);
			}
		}
	`,
	arrow: css`
		cursor: pointer;
	`,
}))

const SearchKeywords = memo(({ items = [] }: SearchKeywordsProps) => {
	const { styles } = useStyles()
	const [enableAnimation, setEnableAnimation] = useState(false)

	const length = useRef(items?.length ?? 0)

	useUpdateEffect(() => {
		if (length.current !== items?.length) {
			setEnableAnimation(true)
			length.current = items?.length ?? 0
		}
	}, [items?.length])

	return (
		<Flex gap={4} wrap="wrap">
			{items?.map((keyword, index) => {
				return (
					<span
						key={keyword}
						className={styles.searchKeyword}
						style={{
							animation:
								enableAnimation && index > length.current
									? `keyword-enter 0.3s ease-in-out ${index * 0.5}s`
									: undefined,
						}}
					>
						{keyword}
					</span>
				)
			})}
		</Flex>
	)
})

export default SearchKeywords

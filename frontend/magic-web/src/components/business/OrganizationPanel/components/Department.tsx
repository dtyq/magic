import type { HTMLAttributes, ReactNode } from "react"
import { memo, useMemo } from "react"
import type { StructureItem } from "@/types/organization"
import { createStyles } from "antd-style"
import { Flex } from "antd"

import { IconChevronRight, IconSitemap } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"

interface DepartmentProps extends HTMLAttributes<HTMLDivElement> {
	data: StructureItem
	/** 是否显示成员数量 */
	showMemberCount?: boolean

	/** 子项箭头区域 - 自定义渲染 */
	itemArrow?: boolean | ((item: StructureItem) => ReactNode)
}

export const useStyles = createStyles(({ isDarkMode, css, prefixCls, token }) => {
	return {
		container: css`
			padding: 10px;
			cursor: pointer;
			width: 100%;
		`,
		count: css`
			overflow: hidden;
			color: ${isDarkMode ? token.magicColorScales.grey[6] : token.magicColorUsages.text[2]};
			text-overflow: ellipsis;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,
		arrow: css`
			color: ${isDarkMode
				? token.magicColorScales.grey[2]
				: token.magicColorUsages.text[2]} !important;
		`,
		departmentIcon: css`
			color: white;
			background: ${token.magicColorScales.brand[5]};
			--${prefixCls}-border-radius: 8px;
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 8px;
		`,
	}
})

/**
 * 部门节点
 */
const Department = memo(
	({ showMemberCount, itemArrow = true, data: item, ...props }: DepartmentProps) => {
		const { styles } = useStyles()

		const arrow = useMemo(() => {
			if (typeof itemArrow === "function") {
				return itemArrow(item)
			}
			return itemArrow ? (
				<MagicIcon component={IconChevronRight} className={styles.arrow} size={24} />
			) : null
		}, [item, itemArrow, styles.arrow])

		return (
			<Flex align="center" className={styles.container} justify="space-between" {...props}>
				<Flex gap={8} align="center">
					<div className={styles.departmentIcon}>
						<MagicIcon color="currentColor" size={20} component={IconSitemap} />
					</div>
					{item.name}
					{showMemberCount ? (
						<span className={styles.count}>({item.employee_sum})</span>
					) : null}
				</Flex>
				{arrow}
			</Flex>
		)
	},
)

export default Department

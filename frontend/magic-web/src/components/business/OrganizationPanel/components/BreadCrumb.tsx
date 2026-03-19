import MagicIcon from "@/components/base/MagicIcon"
import ComponentRender from "@/components/ComponentRender"
import { DefaultComponents } from "@/components/ComponentRender/config/defaultComponents"
import { IconChevronRight } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { Fragment } from "react/jsx-runtime"
import OrganizationRender from "../../OrganizationRender"
import { useCurrentMagicOrganization } from "@/models/user/hooks"
import { useMemoizedFn } from "ahooks"
import { MouseEventHandler, useRef, useEffect } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const useStyles = createStyles(
	({ isDarkMode, css, token }, { isMobile }: { isMobile: boolean }) => {
		return {
			avatar: css`
				border: 1px solid ${token.magicColorUsages.border};
				border-radius: 8px;
			`,
			breadcrumb: css`
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
				padding: 10px 0;
				${isMobile
					? `
					min-height: 40px;
					padding: 0 10px;
					border-bottom: 1px solid ${token.magicColorUsages.border};
				`
					: ""}
			`,
			breadcrumbContent: css`
				flex-wrap: ${isMobile ? "nowrap" : "wrap"};
				overflow-x: auto;
				color: ${token.magicColorUsages.text[2]};

				&::-webkit-scrollbar {
					display: none;
				}
			`,
			breadcrumbItem: css`
				cursor: pointer;
				color: ${token.magicColorUsages.text[2]};
				white-space: nowrap;
				overflow: hidden;
				flex-shrink: 0;

				&:hover {
					color: ${isDarkMode
					? token.magicColorScales.brand[6]
					: token.colorPrimaryHover};
				}

				&:last-child {
					color: ${isDarkMode ? token.magicColorScales.brand[5] : token.colorPrimary};
				}
			`,
		}
	},
)

const BreadCrumb = ({
	onChangeSelectedPath,
	selectedPath,
	breadcrumbRightNode,
}: {
	selectedPath: { id: string; name: string }[]
	onChangeSelectedPath: (path: { id: string; name: string }[]) => void
	breadcrumbRightNode: React.ReactNode
}) => {
	const isMobile = useIsMobile()
	const { styles } = useStyles({ isMobile })
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const organization = useCurrentMagicOrganization()

	// Auto scroll to right when selectedPath changes
	useEffect(() => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
		}
	}, [selectedPath])
	/**
	 * 点击导航子项，跳转对应的部门成员列表
	 */
	const handleClickNavigateItem = useMemoizedFn<MouseEventHandler<HTMLSpanElement>>((e) => {
		const index = e.currentTarget.dataset.layerIndex
		if (index) {
			onChangeSelectedPath(selectedPath.slice(0, Number(index) + 1))
		}
	})

	return (
		<Flex className={styles.breadcrumb} align="center" gap={4} wrap="wrap">
			<div className={styles.avatar} style={{ display: isMobile ? "none" : "block" }}>
				<ComponentRender componentName={DefaultComponents.OrganizationAvatarRender} />
			</div>
			<Flex
				ref={scrollContainerRef}
				flex={1}
				align="center"
				className={styles.breadcrumbContent}
			>
				<span className={styles.breadcrumbItem} onClick={() => onChangeSelectedPath([])}>
					<OrganizationRender organizationCode={organization?.magic_organization_code} />
				</span>
				{selectedPath?.map((item, index) => {
					const arrowKey = `arrow-${index}`
					const key = `item-${index}`
					return (
						<Fragment key={key}>
							<MagicIcon
								style={{ flexShrink: 0 }}
								component={IconChevronRight}
								key={arrowKey}
								size={18}
								color="currentColor"
							/>
							<span
								key={key}
								className={styles.breadcrumbItem}
								data-layer-index={index}
								onClick={handleClickNavigateItem}
							>
								{item.name}
							</span>
						</Fragment>
					)
				})}
			</Flex>
			{breadcrumbRightNode}
		</Flex>
	)
}

export default BreadCrumb

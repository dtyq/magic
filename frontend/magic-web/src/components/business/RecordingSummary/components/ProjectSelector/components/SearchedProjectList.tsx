import { createStyles } from "antd-style"
import { Empty } from "antd"
import ProjectItem from "./ProjectItem"
import { SearchedProjectListProps } from "../types"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { useRef, useEffect } from "react"
import { useKeyPress, useMemoizedFn } from "ahooks"
import FlexBox from "@/components/base/FlexBox"
import MagicSpin from "@/components/base/MagicSpin"
import useScrollLoad from "@/hooks/use-scroll-load"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"

const useStyles = createStyles(({ css, token, prefixCls }) => ({
	projectList: css`
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		padding: 10px;
		height: 100%;
		overflow-y: auto;
		height: 60vh;

		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background-color: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${token.colorFillTertiary};
			border-radius: 2px;

			&:hover {
				background-color: ${token.colorFillSecondary};
			}
		}
	`,

	loadingContainer: css`
		height: 100%;
	`,

	emptyContainer: css`
		padding: 20px;
		text-align: center;
		height: 60vh;

		.${prefixCls}-empty-description {
			color: ${token.colorTextTertiary};
			font-size: 14px;
		}
	`,
}))

function SearchedProjectList({
	selectedProject,
	onProjectClick,
	keyword,
	setKeyword,
	emptyText,
}: SearchedProjectListProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const scrollRef = useRef<HTMLDivElement>(null)
	const searchTimeoutRef = useRef<NodeJS.Timeout>()

	// Use scroll load hook for searched projects
	const {
		data: projects,
		loading,
		onScroll,
		reload,
		reset,
	} = useScrollLoad<ProjectListItem>({
		loadFn: async ({ page, pageSize }) => {
			if (!keyword?.trim()) {
				return { list: [], hasMore: false }
			}

			const result = await SuperMagicApi.getProjects({
				project_name: keyword,
				page,
				page_size: pageSize,
			})

			return {
				list: result.list,
				hasMore: result.list.length >= pageSize,
			}
		},
	})

	// Debounced search effect
	const debouncedSearch = useMemoizedFn(() => {
		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current)
		}

		searchTimeoutRef.current = setTimeout(() => {
			if (keyword?.trim()) {
				reload()
			} else {
				reset()
			}
		}, 500)
	})

	useEffect(() => {
		debouncedSearch()

		return () => {
			if (searchTimeoutRef.current) {
				clearTimeout(searchTimeoutRef.current)
			}
		}
	}, [keyword, debouncedSearch])

	const handleExitSearch = () => {
		setKeyword?.("")
		reset()
	}

	useKeyPress("esc", handleExitSearch)

	return (
		<>
			<MagicSpin spinning={loading} className={styles.loadingContainer}>
				{!projects.length ? (
					<FlexBox align="center" justify="center" className={styles.emptyContainer}>
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description={emptyText}
							style={{ margin: 0 }}
						/>
					</FlexBox>
				) : (
					<div
						ref={scrollRef}
						className={styles.projectList}
						onScroll={(e) => onScroll(e.currentTarget)}
					>
						{projects.map((project) => (
							<ProjectItem
								key={project.id}
								project={project}
								selected={project.id === selectedProject?.id}
								onClick={onProjectClick}
								showWorkspaceName
							/>
						))}
					</div>
				)}
			</MagicSpin>
		</>
	)
}

export default SearchedProjectList

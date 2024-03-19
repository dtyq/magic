import MagicButton from "@/opensource/components/base/MagicButton"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useSize } from "ahooks"
import { Col, Empty, Input, Row } from "antd"
import { cx } from "antd-style"
import { memo, useRef, useState } from "react"
import { useStyles as useCommonStyles } from "../FileManager/styles"
import { useStyles } from "./styles"
import useData from "./useData"

export default memo(function DeployedWebsites() {
	const { styles } = useStyles()
	const { styles: commonStyles } = useCommonStyles()
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	const [searchKeywords, setSearchKeywords] = useState("")
	const { data, loading, setData } = useData({ searchKeywords })

	const content = data.length ? (
		<div className={styles.dataContainer}>
			<Row gutter={[10, 10]}>
				{data.map((item) => {
					return (
						<Col xs={24} sm={12} md={8} lg={6} xxl={4} key={item.id}>
							<div className={styles.item}>
								<div className={styles.itemHeader}>
									<div className={styles.itemName}>{item.name}</div>
									<div className={styles.itemDescription}>{item.description}</div>
									<div className={styles.itemImage}>123</div>
								</div>
								<div className={styles.itemFooter}>
									<MagicButton type="link" className={styles.button}>
										打开链接
									</MagicButton>
									<MagicButton type="link" className={styles.button}>
										设置权限
									</MagicButton>
									<MagicButton type="link" danger className={styles.button}>
										删除
									</MagicButton>
								</div>
							</div>
						</Col>
					)
				})}
			</Row>
		</div>
	) : (
		<div className={commonStyles.emptyWrapper}>
			<Empty description="暂无创建的网站" image={Empty.PRESENTED_IMAGE_SIMPLE} />
		</div>
	)

	return (
		<div className={commonStyles.pageContainer}>
			<div className={commonStyles.title}>创建的网站</div>
			<div className={commonStyles.description}>管理您通过超级麦吉生成的网站</div>
			<div className={commonStyles.formHeader}>
				<Input
					placeholder="搜索网站"
					className={commonStyles.searchInput}
					value={searchKeywords}
					onChange={(event) => {
						setSearchKeywords(event.target.value)
					}}
				/>
			</div>
			<div ref={containerRef} className={cx(commonStyles.pageContent, styles.pageContent)}>
				{loading || !containerSize ? (
					<div className={commonStyles.loadingWrapper}>
						<MagicSpin />
					</div>
				) : (
					content
				)}
			</div>
		</div>
	)
})

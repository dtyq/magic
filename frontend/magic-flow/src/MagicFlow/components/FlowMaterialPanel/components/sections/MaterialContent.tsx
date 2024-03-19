import React, { memo } from "react"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"
import MaterialItem from "../../components/PanelMaterial/MaterialItem"

interface MaterialContentProps {
	tabContents: any[]
	tab: string
	keyword: string
}

const MaterialContent = memo(({ tabContents, tab, keyword }: MaterialContentProps) => {
	return (
		<div className={clsx(styles.materials, `${prefix}materials`)}>
			{tabContents.map(([DynamicContent, showContent], index) => {
				return (
					<div
						key={`materials-panel-item-${index}`}
						style={{ display: `${showContent ? "block" : "none"}` }}
						className={clsx(styles.blockItem, `${prefix}block-item`)}
					>
						{/* @ts-ignore */}
						<DynamicContent
							currentTab={tab}
							keyword={keyword}
							MaterialItemFn={(dynamicProps: any) => (
								<MaterialItem {...dynamicProps} />
							)}
						/>
					</div>
				)
			})}
		</div>
	)
})

export default MaterialContent

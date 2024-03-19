import React, { memo } from "react"
import NodeContent from "./NodeContent"
import NodeHandles from "./NodeHandles"
import NodeHeader from "./NodeHeader"

interface NodeChildrenProps {
	// NodeHeader相关属性
	id: string
	headerBackgroundColor: string
	AvatarComponent: React.ReactNode
	isEdit: boolean
	setIsEdit: (isEdit: boolean) => void
	nodeName: string
	onChangeName: (name: string) => void
	openPopup: boolean
	setOpenPopup: (open: boolean) => void
	onDropdownClick: (value: any) => void
	type: string
	desc: string
	customNodeRenderConfig: any
	HeaderRight: React.ComponentType<any> | null
	allowDebug: boolean
	isDebug: boolean
	onDebugChange: (checked: boolean) => void

	// NodeHandles相关属性
	showDefaultSourceHandle: boolean
	withTargetHandle: boolean
	isConnectable: boolean
	isSelected: boolean
	canConnect: boolean
	isTarget: boolean

	// NodeContent相关属性
	ParamsComp: React.ComponentType<any> | null
}

// 使用memo包装NodeChildren组件，避免父组件重新渲染时不必要的重渲染
const NodeChildren = memo(
	({
		// NodeHeader props
		id,
		headerBackgroundColor,
		AvatarComponent,
		isEdit,
		setIsEdit,
		nodeName,
		onChangeName,
		openPopup,
		setOpenPopup,
		onDropdownClick,
		type,
		desc,
		customNodeRenderConfig,
		HeaderRight,
		allowDebug,
		isDebug,
		onDebugChange,

		// NodeHandles props
		showDefaultSourceHandle,
		withTargetHandle,
		isConnectable,
		isSelected,
		canConnect,
		isTarget,

		// NodeContent props
		ParamsComp,
	}: NodeChildrenProps) => {
		return (
			<>
				<NodeHeader
					id={id}
					headerBackgroundColor={headerBackgroundColor}
					AvatarComponent={AvatarComponent}
					isEdit={isEdit}
					setIsEdit={setIsEdit}
					nodeName={nodeName}
					onChangeName={onChangeName}
					openPopup={openPopup}
					setOpenPopup={setOpenPopup}
					onDropdownClick={onDropdownClick}
					type={type}
					desc={desc}
					customNodeRenderConfig={customNodeRenderConfig}
					HeaderRight={HeaderRight}
					allowDebug={allowDebug}
					isDebug={isDebug}
					onDebugChange={onDebugChange}
				/>

				<NodeHandles
					showDefaultSourceHandle={showDefaultSourceHandle}
					withTargetHandle={withTargetHandle}
					nodeId={id}
					isConnectable={isConnectable}
					isSelected={isSelected}
					canConnect={canConnect}
					isTarget={isTarget}
					showParamsComp
				/>

				<NodeContent showParamsComp ParamsComp={ParamsComp} />
			</>
		)
	},
)

export default NodeChildren

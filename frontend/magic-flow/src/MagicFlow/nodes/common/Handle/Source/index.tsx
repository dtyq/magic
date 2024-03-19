import FlowPopup from "@/MagicFlow/components/FlowPopup"
import { useFlowData } from "@/MagicFlow/context/FlowContext/useFlow"
import { Popover } from "antd"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import clsx from "clsx"
import React, { useEffect, useMemo, useState } from "react"
import { Handle, Position } from "reactflow"
import { PopupProvider } from "../../context/Popup/Provider"
import styles from "./index.module.less"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"

type SourceHandleProps = {
	isConnectable?: boolean
	nodeId: string
	id?: string
	isSelected: boolean
	type?: "source" | "target"
	position?: Position
	// 当type为target时
	isTarget?: boolean
	[key: string]: any
}

export default function CustomHandle({
	isConnectable,
	nodeId,
	id,
	isSelected,
	position = Position.Right,
	type = "source",
	isTarget,
	...props
}: SourceHandleProps) {
	const [handleOvered, setHandleOvered] = useState(false)

	const { debuggerMode } = useFlowData()

	const [openPopup, setPopupOpen] = useState(false)

	const handleRightMouseEnter = useMemoizedFn(() => {
		setHandleOvered(true)
	})

	const handleRightMouseLeave = useMemoizedFn(() => {
		setHandleOvered(false)
	})

	const onAddIconClick = useMemoizedFn((e) => {
		e.stopPropagation()
		flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, nodeId)
		setPopupOpen(true)
	})

	useEffect(() => {
		const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, () => {
			setPopupOpen(false)
		})
		return () => {
			cleanup()
		}
	}, [])

	const handleStyle = useMemo(() => {
		if (!handleOvered && !openPopup) {
			const resultStyle =
				type === "source"
					? {
							borderWidth: "3px",
							width: "12px",
							height: "12px",
							right: "-7px",
							borderRadius: "50%",
					  }
					: {
							width: "12px",
							height: "12px",
							left: "-7px",
							borderRadius: "50%",
							transition: "none",
					  }
			if (isSelected) {
				return resultStyle
			}
			resultStyle.borderWidth = "2px"
			return resultStyle
		}
		return type === "source"
			? {
					borderWidth: "3px",
					height: "20px",
					width: "20px",
					right: "-11px",
			  }
			: {
					height: "12px",
					width: "12px",
					left: "-7px",
					transition: "none",
					borderWidth: "2px",
			  }
	}, [type, handleOvered, openPopup, isSelected])

	const HandleComponent = useMemo(() => {
		return (
			<Handle
				type={type}
				position={position}
				isConnectable={isConnectable}
				className={clsx(styles.handle, {
					[styles.isSelected]: isSelected,
					[styles.isTarget]: isTarget,
				})}
				onMouseEnter={handleRightMouseEnter}
				onMouseLeave={handleRightMouseLeave}
				onClick={onAddIconClick}
				id={id}
				style={handleStyle}
				{...props}
			>
				{/* <IconPlus
        className={clsx(styles.addIcon)}
        style={(handleOvered || openPopup) ? { fontSize: "14px", opacity: 1 } : {}}
    /> */}
			</Handle>
		)
	}, [
		type,
		position,
		isConnectable,
		isSelected,
		isTarget,
		handleRightMouseEnter,
		handleRightMouseLeave,
		onAddIconClick,
		id,
		handleStyle,
		props,
	])

	return (
		<PopupProvider
			closePopup={() => {
				setPopupOpen(false)
			}}
		>
			{isConnectable &&
				(type === "target" ? (
					HandleComponent
				) : (
					<Popover
						content={
							<FlowPopup
								source={nodeId}
								target={null}
								edgeId={null}
								sourceHandle={id}
							/>
						}
						placement="right"
						showArrow={false}
						overlayClassName={styles.popup}
						open={openPopup}
					>
						{HandleComponent}
					</Popover>
				))}
			{debuggerMode && <span>{id}</span>}
		</PopupProvider>
	)
}

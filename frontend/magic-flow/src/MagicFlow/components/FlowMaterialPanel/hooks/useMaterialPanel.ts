import { useState, useEffect, useMemo } from "react"
import { useFlowUI } from "@/MagicFlow/context/FlowContext/useFlow"

export default function useMaterialPanel() {
	// 使用专用的hook替代全量useFlow，减少不必要的重渲染
	const { showMaterialPanel, setShowMaterialPanel } = useFlowUI()
	const [isEditing, setIsEditing] = useState(false)

	// 使用useMemo缓存样式对象，避免每次渲染创建新对象
	const stickyButtonStyle = useMemo(() => {
		return {
			top: "91px",
			left: showMaterialPanel ? "298px" : "4px",
		}
	}, [showMaterialPanel])

	useEffect(() => {
		if (isEditing) {
			setShowMaterialPanel?.(false)
		}
	}, [isEditing, setShowMaterialPanel])

	return {
		show: showMaterialPanel,
		setShow: setShowMaterialPanel,
		isEditing,
		setIsEditing,
		stickyButtonStyle,
	}
} 
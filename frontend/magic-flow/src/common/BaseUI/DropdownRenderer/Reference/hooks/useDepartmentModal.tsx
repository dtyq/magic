/**
 * 部门选择器相关的状态
 */

import { useTextareaModeContext } from "@/MagicExpressionWidget/context/TextareaMode/useTextareaModeContext"
import { useMemoizedFn, useResetState } from "ahooks"
import { useEffect } from "react"

type DepartmentProps = {
	dropdownOpen?: boolean
}

export default function useDepartmentModal({ dropdownOpen }: DepartmentProps) {
	const [open, setOpen, resetOpen] = useResetState(false)

	const { closeSelectPanel } = useTextareaModeContext()

	const closeModal = useMemoizedFn(() => {
		setOpen(false)
		closeSelectPanel()
	})

	useEffect(() => {
		if (dropdownOpen) {
			setOpen(true)
		}
	}, [dropdownOpen])

	return {
		open,
		closeModal,
	}
}

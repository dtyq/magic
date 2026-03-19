import React from "react"

export interface ProjectSiderItem {
	key: string
	title: string
	icon?: React.ReactNode
	content?: React.ReactNode
	visible?: boolean
}

export interface ProjectSiderProps {
	className?: string
	items?: ProjectSiderItem[]
	// 支持可调整宽度
	width?: number | string
	// Controlled tab state
	value?: string
	onValueChange?: (value: string) => void
}

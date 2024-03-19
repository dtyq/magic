import { useState } from "react"
import { DashboardItemData } from "./types"

export default function useData() {
	const [expandedKeys, setExpandedKeys] = useState<string[]>([])

	const [checkedList, setCheckedList] = useState<DashboardItemData[]>([])

	const [list, setList] = useState<DashboardItemData[]>([
		{
			id: "1",
			name: "目录1",
			type: "folder",
			children: [
				{
					id: "1-1",
					name: "文件1-1",
					type: "folder",
					children: [
						{
							id: "1-1-1",
							name: "文件1-1-1",
							type: "dashboard",
						},
					],
				},
				{
					id: "1-2",
					name: "文件1-2",
					type: "folder",
					children: [
						{
							id: "1-2-1",
							name: "文件1-2-1",
							type: "folder",
							children: [
								{
									id: "1-2-1-1",
									name: "文件1-2-1-1",
									type: "dashboard",
								},
							],
						},
						{
							id: "1-2-2",
							name: "文件1-2-2",
							type: "dashboard",
						},
					],
				},
				{
					id: "1-3",
					name: "文件1",
					type: "dashboard",
					isFavorite: true,
				},
				{
					id: "1-4",
					name: "文件2",
					type: "dashboard",
					isFavorite: false,
				},
			],
		},
		{
			id: "3",
			name: "目录2",
			type: "folder",
			children: [
				{
					id: "3-1",
					name: "文件3",
					type: "dashboard",
					isFavorite: true,
				},
			],
		},
		{
			id: "2",
			name: "看板1",
			type: "dashboard",
			isFavorite: false,
		},
	])

	return {
		list,
		setList,

		expandedKeys,
		setExpandedKeys,

		checkedList,
		setCheckedList,
	}
}

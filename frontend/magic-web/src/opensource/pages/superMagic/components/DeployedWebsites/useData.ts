import { useEffect, useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface DataItem {
	id: string
	name: string
	description: string
	url: string
	image_url: string
	deployTime: string
	status: "online" | "offline"
	visits: number
	auth: {
		canEdit: boolean
		canDelete: boolean
		isOwner: boolean
	}
}

interface UseDataProps {
	searchKeywords?: string
}

export default function useData({ searchKeywords }: UseDataProps) {
	const [data, setData] = useState<DataItem[]>([])
	const [loading, setLoading] = useState(false)

	const fetchData = async () => {
		setLoading(true)
		try {
			// 这里应该调用API获取部署的网站列表
			// 暂时使用模拟数据
			setTimeout(() => {
				const mockWebsites: DataItem[] = [
					{
						id: "1",
						name: "Quantum Computing Learning Hub",
						description:
							"Explore the fascinating realm of quantum computing through interactive visualizations and hands-on learning experiences.",
						url: "https://quantum-hub.example.com",
						image_url: "https://via.placeholder.com/600x300?text=Quantum+Computing+Hub",
						deployTime: "2023-10-15T09:30:00",
						status: "online",
						visits: 1352,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "2",
						name: "IBIT ETF Dashboard",
						description:
							"Real-time analysis of IBIT ETF with price tracking, volatility, and risk assessment",
						url: "https://ibit-dashboard.example.com",
						image_url: "https://via.placeholder.com/600x300?text=IBIT+ETF+Dashboard",
						deployTime: "2023-09-28T14:15:00",
						status: "online",
						visits: 897,
						auth: {
							canEdit: true,
							canDelete: false,
							isOwner: false,
						},
					},
					{
						id: "3",
						name: "Tesla Stock Analysis Dashboard",
						description:
							"Comprehensive analysis of Tesla's financial performance, market position, and investment outlook",
						url: "https://tesla-analysis.example.com",
						image_url: "https://via.placeholder.com/600x300?text=Tesla+Stock+Analysis",
						deployTime: "2023-11-05T11:45:00",
						status: "offline",
						visits: 2156,
						auth: {
							canEdit: false,
							canDelete: false,
							isOwner: false,
						},
					},
					{
						id: "4",
						name: "Physics Fun – Interactive Middle School Physics",
						description:
							"An interactive website for teaching middle school physics concepts",
						url: "https://physics-fun.example.com",
						image_url: "https://via.placeholder.com/600x300?text=Physics+Fun",
						deployTime: "2023-10-20T16:20:00",
						status: "online",
						visits: 1823,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "5",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "6",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "7",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "8",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "9",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "10",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "11",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "12",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
					{
						id: "13",
						name: "GovDeals Profit Potential Dashboard",
						description:
							"This dashboard presents an analysis of GovDeals listings to identify items with the highest profit potential for flipping",
						url: "https://govdeals-profit.example.com",
						image_url:
							"https://via.placeholder.com/600x300?text=GovDeals+Profit+Dashboard",
						deployTime: "2023-08-10T10:30:00",
						status: "offline",
						visits: 732,
						auth: {
							canEdit: true,
							canDelete: true,
							isOwner: true,
						},
					},
				]
				setData(mockWebsites)
				setLoading(false)
			}, 500)
		} catch (error) {
			magicToast.error("获取部署网站列表失败")
			console.error("Failed to fetch deployed websites:", error)
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchData()
	}, [])

	return {
		data,
		setData,
		loading,
	}
}

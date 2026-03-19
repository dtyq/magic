import { SkillPanelType, OptionViewType, type SkillPanelConfig } from "../../panels/types"

/**
 * Default analyze data panel configuration
 */
export const defaultAnalyzeDataPanelConfig: SkillPanelConfig[] = [
	{
		type: SkillPanelType.GUIDE,
		title: { zh_CN: "快速开始", en_US: "Quick Start" },
		guide: {
			items: [
				{
					key: "import-excel",
					title: { zh_CN: "导入 Excel", en_US: "Import Excel" },
					description: {
						zh_CN: "上传 CSV/Excel 即时可视化数据",
						en_US: "Upload CSV/Excel to visualize your data instantly.",
					},
					icon: "Upload",
				},
				{
					key: "connect-database",
					title: { zh_CN: "连接数据库", en_US: "Connect Database" },
					description: {
						zh_CN: "同步实时数据库，生成实时看板",
						en_US: "Sync your live databases for real-time dashboards.",
					},
					icon: "Database",
				},
			],
		},
	},
	{
		type: SkillPanelType.DEMO,
		title: { zh_CN: "灵感探索", en_US: "Inspiration Exploration" },
		expandable: true,
		default_expanded: true,
		demo: {
			view_type: OptionViewType.TEXT_LIST,
			groups: [
				{
					group_key: "data-analysis",
					group_name: { zh_CN: "数据分析", en_US: "Data Analysis" },
					children: [
						{
							value: "sales-trends",
							label: {
								zh_CN: "分析上月销售数据，识别关键趋势与洞察",
								en_US: "Analyze last month's sales data and identify key trends and insights",
							},
						},
						{
							value: "seo-performance",
							label: {
								zh_CN: "分析网站 SEO 表现并提供可执行的优化建议",
								en_US: "Analyze your website's SEO performance and provide actionable optimization recommendations",
							},
						},
						{
							value: "marketing-charts",
							label: {
								zh_CN: "将营销数据转化为清晰直观的图表",
								en_US: "Turn your raw marketing data into clear, intuitive charts",
							},
						},
						{
							value: "customer-behavior",
							label: {
								zh_CN: "分析客户行为模式并生成分群报告",
								en_US: "Analyze customer behavior patterns and generate segment reports",
							},
						},
						{
							value: "financial-forecast",
							label: {
								zh_CN: "基于历史数据趋势创建财务预测",
								en_US: "Create financial forecasts based on historical data trends",
							},
						},
						{
							value: "inventory-optimization",
							label: {
								zh_CN: "根据销售与需求模式优化库存水平",
								en_US: "Optimize inventory levels based on sales and demand patterns",
							},
						},
						{
							value: "conversion-funnel",
							label: {
								zh_CN: "分析转化漏斗并识别流失节点",
								en_US: "Analyze conversion funnel and identify drop-off points",
							},
						},
						{
							value: "competitor-analysis",
							label: {
								zh_CN: "与竞品基准对比绩效指标",
								en_US: "Compare performance metrics against competitor benchmarks",
							},
						},
						{
							value: "user-engagement",
							label: {
								zh_CN: "追踪并分析跨平台用户参与度指标",
								en_US: "Track and analyze user engagement metrics across platforms",
							},
						},
						{
							value: "revenue-attribution",
							label: {
								zh_CN: "将收入来源归因于具体营销渠道",
								en_US: "Attribute revenue sources to specific marketing channels",
							},
						},
					],
				},
			],
		},
	},
]

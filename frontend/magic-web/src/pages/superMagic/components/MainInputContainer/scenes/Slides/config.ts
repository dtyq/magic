import { SkillPanelType, OptionViewType, type SkillPanelConfig } from "../../panels/types"
/**
 * Default slides panel configuration
 * This can be replaced with data from API or other sources
 */
export const defaultSlidesPanelConfig: SkillPanelConfig[] = [
	{
		type: SkillPanelType.FIELD,
		title: { zh_CN: "风格", en_US: "Style" },
		expandable: true,
		default_expanded: true,
		field: {
			items: [
				{
					data_key: "style",
					label: { zh_CN: "风格", en_US: "Style" },
					has_leading_icon: true,
					leading_icon: "Square",
					option_view_type: OptionViewType.GRID,
					options: [
						{
							group_key: "landing-page",
							group_name: { zh_CN: "落地页", en_US: "Landing Page" },
							group_icon: "LayoutTemplate",
							children: [
								{
									value: "landing-1",
									label: "Modern Landing",
									thumbnail_url:
										"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
									description: "Modern landing page design",
								},
								{
									value: "landing-2",
									label: "SaaS Product",
									thumbnail_url:
										"https://images.unsplash.com/photo-1557853197-aefb550b6fdc?w=800&h=600&fit=crop",
									description: "SaaS product landing page",
								},
								{
									value: "landing-3",
									label: "Startup Launch",
									thumbnail_url:
										"https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&h=600&fit=crop",
									description: "Startup launch page with hero section",
								},
								{
									value: "landing-4",
									label: "Mobile App",
									thumbnail_url:
										"https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop",
									description: "Mobile app showcase landing page",
								},
								{
									value: "landing-5",
									label: "E-commerce Store",
									thumbnail_url:
										"https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=600&fit=crop",
									description: "E-commerce storefront landing page",
								},
							],
						},
						{
							group_key: "dashboard",
							group_name: { zh_CN: "数据面板", en_US: "Dashboard" },
							group_icon: "LayoutDashboard",
							children: [
								{
									value: "dashboard-1",
									label: "Analytics Dashboard",
									thumbnail_url:
										"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
									description: "Analytics dashboard layout",
								},
								{
									value: "dashboard-2",
									label: "Sales Dashboard",
									thumbnail_url:
										"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
									description: "Sales metrics and performance tracking",
								},
								{
									value: "dashboard-3",
									label: "E-commerce Admin",
									thumbnail_url:
										"https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=600&fit=crop",
									description: "E-commerce admin dashboard",
								},
								{
									value: "dashboard-4",
									label: "Project Management",
									thumbnail_url:
										"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop",
									description: "Project tracking dashboard",
								},
								{
									value: "dashboard-5",
									label: "Financial Overview",
									thumbnail_url:
										"https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=600&fit=crop",
									description: "Financial metrics dashboard",
								},
								{
									value: "dashboard-6",
									label: "Healthcare Monitor",
									thumbnail_url:
										"https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop",
									description: "Healthcare patient monitoring dashboard",
								},
							],
						},
						{
							group_key: "portfolio",
							group_name: { zh_CN: "作品集", en_US: "Portfolio" },
							group_icon: "Image",
							children: [
								{
									value: "portfolio-1",
									label: "Creative Portfolio",
									thumbnail_url:
										"https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=600&fit=crop",
									description: "Creative portfolio showcase",
								},
								{
									value: "portfolio-2",
									label: "Designer Portfolio",
									thumbnail_url:
										"https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
									description: "UI/UX designer portfolio",
								},
								{
									value: "portfolio-3",
									label: "Photography Portfolio",
									thumbnail_url:
										"https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=600&fit=crop",
									description: "Professional photography showcase",
								},
								{
									value: "portfolio-4",
									label: "Developer Portfolio",
									thumbnail_url:
										"https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop",
									description: "Software developer project showcase",
								},
								{
									value: "portfolio-5",
									label: "Artist Portfolio",
									thumbnail_url:
										"https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=600&fit=crop",
									description: "Digital artist gallery portfolio",
								},
							],
						},
						{
							group_key: "corporate-website",
							group_name: { zh_CN: "企业官网", en_US: "Corporate Website" },
							group_icon: "Hotel",
							children: [
								{
									value: "corporate-1",
									label: "Professional Corporate",
									thumbnail_url:
										"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
									description: "Professional corporate website",
								},
								{
									value: "corporate-2",
									label: "Tech Company",
									thumbnail_url:
										"https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
									description: "Technology company website",
								},
								{
									value: "corporate-3",
									label: "Consulting Firm",
									thumbnail_url:
										"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop",
									description: "Business consulting firm website",
								},
								{
									value: "corporate-4",
									label: "Law Firm",
									thumbnail_url:
										"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=600&fit=crop",
									description: "Professional law firm website",
								},
								{
									value: "corporate-5",
									label: "Financial Services",
									thumbnail_url:
										"https://images.unsplash.com/photo-1560472355-536de3962603?w=800&h=600&fit=crop",
									description: "Financial services company website",
								},
							],
						},
						{
							group_key: "personal-website",
							group_name: { zh_CN: "个人网站", en_US: "Personal Website" },
							group_icon: "SquareUserRound",
							children: [
								{
									value: "personal-1",
									label: "Personal Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=600&fit=crop",
									description: "Personal blog website",
								},
								{
									value: "personal-2",
									label: "Digital Resume",
									thumbnail_url:
										"https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=600&fit=crop",
									description: "Interactive resume website",
								},
								{
									value: "personal-3",
									label: "Writer's Site",
									thumbnail_url:
										"https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=600&fit=crop",
									description: "Author and writer personal site",
								},
								{
									value: "personal-4",
									label: "Coach Profile",
									thumbnail_url:
										"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
									description: "Life coach personal website",
								},
								{
									value: "personal-5",
									label: "Freelancer Hub",
									thumbnail_url:
										"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop",
									description: "Freelancer portfolio and contact site",
								},
							],
						},
						{
							group_key: "blog",
							group_name: { zh_CN: "博客", en_US: "Blog" },
							group_icon: "FileType",
							children: [
								{
									value: "blog-1",
									label: "Modern Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=600&fit=crop",
									description: "Modern blog design",
								},
								{
									value: "blog-2",
									label: "Tech Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=600&fit=crop",
									description: "Technology and programming blog",
								},
								{
									value: "blog-3",
									label: "Travel Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop",
									description: "Travel and adventure blog",
								},
								{
									value: "blog-4",
									label: "Food Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop",
									description: "Cooking and recipe blog",
								},
								{
									value: "blog-5",
									label: "Fashion Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop",
									description: "Fashion and style blog",
								},
								{
									value: "blog-6",
									label: "Lifestyle Blog",
									thumbnail_url:
										"https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop",
									description: "Lifestyle and wellness blog",
								},
							],
						},
						{
							group_key: "mini-games",
							group_name: { zh_CN: "小游戏", en_US: "Mini Games" },
							group_icon: "Gamepad2",
							children: [
								{
									value: "game-1",
									label: "Casual Game",
									thumbnail_url:
										"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=600&fit=crop",
									description: "Casual mini game",
								},
								{
									value: "game-2",
									label: "Puzzle Game",
									thumbnail_url:
										"https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=800&h=600&fit=crop",
									description: "Brain teaser puzzle game",
								},
								{
									value: "game-3",
									label: "Arcade Game",
									thumbnail_url:
										"https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&h=600&fit=crop",
									description: "Retro arcade style game",
								},
								{
									value: "game-4",
									label: "Card Game",
									thumbnail_url:
										"https://images.unsplash.com/photo-1541278107931-e006523892df?w=800&h=600&fit=crop",
									description: "Online card game",
								},
								{
									value: "game-5",
									label: "Word Game",
									thumbnail_url:
										"https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=800&h=600&fit=crop",
									description: "Word puzzle and vocabulary game",
								},
							],
						},
						{
							group_key: "productivity-tools",
							group_name: { zh_CN: "效率工具", en_US: "Productivity Tools" },
							group_icon: "PencilRuler",
							children: [
								{
									value: "tool-1",
									label: "Task Manager",
									thumbnail_url:
										"https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=600&fit=crop",
									description: "Productivity tool interface",
								},
								{
									value: "tool-2",
									label: "Note Taking App",
									thumbnail_url:
										"https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&h=600&fit=crop",
									description: "Digital note-taking application",
								},
								{
									value: "tool-3",
									label: "Time Tracker",
									thumbnail_url:
										"https://images.unsplash.com/photo-1501139083538-0139583c060f?w=800&h=600&fit=crop",
									description: "Time tracking and analytics tool",
								},
								{
									value: "tool-4",
									label: "Calendar Planner",
									thumbnail_url:
										"https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=800&h=600&fit=crop",
									description: "Smart calendar and scheduling tool",
								},
								{
									value: "tool-5",
									label: "Kanban Board",
									thumbnail_url:
										"https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=600&fit=crop",
									description: "Visual project management board",
								},
								{
									value: "tool-6",
									label: "Habit Tracker",
									thumbnail_url:
										"https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=800&h=600&fit=crop",
									description: "Daily habit tracking application",
								},
							],
						},
						{
							group_key: "slides",
							group_name: { zh_CN: "幻灯片", en_US: "Slides" },
							group_icon: "LayoutTemplate",
							children: [
								{
									value: "let-buddy-create",
									label: "Let Buddy Create",
								},
								{
									value: "obsidian-zen",
									label: "Obsidian Zen",
									thumbnail_url:
										"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
									description: "2026 GLOBAL MARKET GROWTH REPORT",
									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "cyber-puse",
									label: "Cyber Pulse",
									thumbnail_url:
										"https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop",
									description: "AI-DRIVEN FUTURE HEALTHCARE SOLUTIONS",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "earthly-breath",
									label: "Earthly Breath",
									thumbnail_url:
										"https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&h=600&fit=crop",
									description:
										"SUSTAINABLE FASHION & CIRCULAR ECONOMY INITIATIVE",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},

								{
									value: "creative-collision",
									label: "Creative Collision",
									thumbnail_url:
										"https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=600&fit=crop",
									description: "SOCIAL MEDIA MARKETING STRATEGY FOR GEN Z",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "classic-narrative",
									label: "Classic Narrative",
									thumbnail_url:
										"https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop",
									description: "LUXURY BRAND GLOBAL EXPANSION ROADMAP",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "industrial-backbone",
									label: "Industrial Backbone",
									thumbnail_url:
										"https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&h=600&fit=crop",
									description: "SMART MANUFACTURING & SUPPLY CHAIN OPTIMIZATION",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "stable-capital",
									label: "Stable Capital",
									thumbnail_url:
										"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop",
									description: "QUARTERLY HEDGE FUND PERFORMANCE ANALYSIS",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "velocity-leap",
									label: "Velociy Leap",
									thumbnail_url:
										"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=600&fit=crop",
									description: "THE FUTURE OF LOGISTICS & INSTANT DELIVERY",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "life-seqence",
									label: "Life Sequence",
									thumbnail_url:
										"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&h=600&fit=crop",
									description: "GENE EDITING TECHNOLOGY RESEARCH REPORT",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "nostalgic-byte",
									label: "Nostalgic Byte",
									thumbnail_url:
										"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=600&fit=crop",
									description: "INDIE GAME DEVELOPERS CONFERENCE KEYNOTE",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},

								{
									value: "visual-bomb",
									label: "Visual Bomb",
									thumbnail_url:
										"https://images.unsplash.com/photo-1558769132-cb1aea1f1f57?w=800&h=600&fit=crop",
									description: "STREETWEAR BRAND COLLABORATION MARKETING",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "geometric-order",
									label: "Geometric Order",
									thumbnail_url:
										"https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&h=600&fit=crop",
									description: "MODERN ARCHITECTURAL DESIGN PHILOSOPHY",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "ink-flow",
									label: "Ink Flow",
									thumbnail_url:
										"https://images.unsplash.com/photo-1513569143478-b38b2c0ef97f?w=800&h=600&fit=crop",
									description: "Oriental Aesthetics in Modern Design",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "nordic-dawn",
									label: "Nordic Dawn",
									thumbnail_url:
										"https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&h=600&fit=crop",
									description: "HOME OFFICE & MENTAL WELL-BEING GUIDE",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
								{
									value: "grained-memory",
									label: "Grained Memory",
									thumbnail_url:
										"https://images.unsplash.com/photo-1574267432644-f610c4ce5435?w=800&h=600&fit=crop",
									description: "ANNUAL INDIE FILM FESTIVAL REVIEW",

									icon_url: "https://api.iconify.design/lucide/presentation.svg",
								},
							],
						},
					],
				},
				{
					data_key: "pages",
					label: { zh_CN: "页数", en_US: "Pages" },
					default_value: "8-12",
					options: [
						{ value: "1-4", label: "1-4" },
						{ value: "5-8", label: "5-8" },
						{ value: "8-12", label: "8-12" },
						{ value: "12+", label: "12+" },
					],
				},
				{
					data_key: "size",
					label: { zh_CN: "尺寸", en_US: "Size" },
					has_leading_icon: true,
					leading_icon: "square",
					options: [
						{ value: "16:9", label: "16:9" },
						{ value: "4:3", label: "4:3" },
						{ value: "1:1", label: "1:1" },
					],
				},
				{
					data_key: "language",
					label: { zh_CN: "语言", en_US: "Language" },
					options: [
						{ value: "auto", label: { zh_CN: "自动", en_US: "Auto" } },
						{ value: "zh", label: { zh_CN: "中文", en_US: "Chinese" } },
						{ value: "en", label: { zh_CN: "英文", en_US: "English" } },
					],
				},
			],
		},
	},
	{
		type: SkillPanelType.GUIDE,
		title: { zh_CN: "快速开始", en_US: "Quick Start" },
		expandable: true,
		default_expanded: true,
		guide: {
			items: [
				{
					key: "topic-to-slides",
					title: { zh_CN: "主题生成幻灯片", en_US: "Topic to Slides" },
					description: {
						zh_CN: "从单一提示词生成完整演示文稿",
						en_US: "Generate a full presentation from a single prompt.",
					},
					icon: "Sparkles",
				},
				{
					key: "outline-to-slides",
					title: { zh_CN: "大纲转幻灯片", en_US: "Outline to Slides" },
					description: {
						zh_CN: "将大纲转化为精美的演示文稿",
						en_US: "Transform your outline into a polished deck.",
					},
					icon: "List",
				},
				{
					key: "file-to-slides",
					title: { zh_CN: "文档转幻灯片", en_US: "File to Slides" },
					description: {
						zh_CN: "将文档即时转换为结构化演示文稿",
						en_US: "Convert docs into structured presentations instantly.",
					},
					icon: "FileUp",
				},
			],
		},
	},
]

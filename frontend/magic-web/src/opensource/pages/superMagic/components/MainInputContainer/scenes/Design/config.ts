import { SkillPanelType, OptionViewType, type SkillPanelConfig } from "../../panels/types"
/**
 * Default slides panel configuration
 * This can be replaced with data from API or other sources
 */
export const defaultDesignPanelConfig: SkillPanelConfig[] = [
	{
		type: SkillPanelType.FIELD,
		field: {
			items: [
				{
					data_key: "size",
					label: { zh_CN: "尺寸", en_US: "Size" },
					options: [
						{ value: "1:1", label: "1:1" },
						{ value: "4:3", label: "4:3" },
						{ value: "16:9", label: "16:9" },
					],
				},
				{
					data_key: "resolution",
					label: { zh_CN: "分辨率", en_US: "Resolution" },
					options: [
						{ value: "1K", label: "1K" },
						{ value: "2K", label: "2K" },
						{ value: "4K", label: "4K" },
					],
				},
				{
					data_key: "upscaleFactor",
					label: { zh_CN: "放大倍数", en_US: "Upscale Factor" },
					options: [
						{ value: "2X", label: "2X" },
						{ value: "1X", label: "1X" },
						{ value: "4X", label: "4X" },
					],
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
			view_type: OptionViewType.WATERFALL,
			groups: [
				{
					group_key: "landing-page",
					group_name: { zh_CN: "落地页", en_US: "Landing Page" },
					group_icon: "LayoutTemplate",
					children: [
						{
							value: "landing-1",
							label: "Modern Landing",
							thumbnail_url:
								"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=600&fit=crop",
							description: "Modern landing page design",
							width: 400,
							height: 600,
						},
						{
							value: "landing-2",
							label: "SaaS Product",
							thumbnail_url:
								"https://images.unsplash.com/photo-1557853197-aefb550b6fdc?w=600&h=400&fit=crop",
							description: "SaaS product landing page",
							width: 600,
							height: 400,
						},
						{
							value: "landing-3",
							label: "Startup Launch",
							thumbnail_url:
								"https://images.unsplash.com/photo-1559028012-481c04fa702d?w=400&h=700&fit=crop",
							description: "Startup launch page with hero section",
							width: 400,
							height: 700,
						},
						{
							value: "landing-4",
							label: "Mobile App",
							thumbnail_url:
								"https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=700&h=450&fit=crop",
							description: "Mobile app showcase landing page",
							width: 700,
							height: 450,
						},
						{
							value: "landing-5",
							label: "E-commerce Store",
							thumbnail_url:
								"https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400&h=650&fit=crop",
							description: "E-commerce storefront landing page",
							width: 400,
							height: 650,
						},
						{
							value: "landing-6",
							label: "Creative Agency",
							thumbnail_url:
								"https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&h=380&fit=crop",
							description: "Creative agency landing page",
							width: 600,
							height: 380,
						},
						{
							value: "landing-7",
							label: "Fintech Platform",
							thumbnail_url:
								"https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=580&fit=crop",
							description: "Financial technology platform landing",
							width: 400,
							height: 580,
						},
						{
							value: "landing-8",
							label: "Marketing Agency",
							thumbnail_url:
								"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=650&h=400&fit=crop",
							description: "Digital marketing agency landing",
							width: 650,
							height: 400,
						},
						{
							value: "landing-9",
							label: "Event Platform",
							thumbnail_url:
								"https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=600&fit=crop",
							description: "Event management platform landing",
							width: 400,
							height: 600,
						},
						{
							value: "landing-10",
							label: "Education Tech",
							thumbnail_url:
								"https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=700&h=450&fit=crop",
							description: "Online education platform landing",
							width: 700,
							height: 450,
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
								"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
							description: "Analytics dashboard layout",
							width: 600,
							height: 400,
						},
						{
							value: "dashboard-2",
							label: "Sales Dashboard",
							thumbnail_url:
								"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=650&fit=crop",
							description: "Sales metrics and performance tracking",
							width: 400,
							height: 650,
						},
						{
							value: "dashboard-3",
							label: "E-commerce Admin",
							thumbnail_url:
								"https://images.unsplash.com/photo-1556761175-b413da4baf72?w=700&h=450&fit=crop",
							description: "E-commerce admin dashboard",
							width: 700,
							height: 450,
						},
						{
							value: "dashboard-4",
							label: "Project Management",
							thumbnail_url:
								"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=700&fit=crop",
							description: "Project tracking dashboard",
							width: 400,
							height: 700,
						},
						{
							value: "dashboard-5",
							label: "Financial Overview",
							thumbnail_url:
								"https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=650&h=400&fit=crop",
							description: "Financial metrics dashboard",
							width: 650,
							height: 400,
						},
						{
							value: "dashboard-6",
							label: "Healthcare Monitor",
							thumbnail_url:
								"https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=520&fit=crop",
							description: "Healthcare patient monitoring dashboard",
							width: 400,
							height: 520,
						},
						{
							value: "dashboard-7",
							label: "CRM Dashboard",
							thumbnail_url:
								"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=380&fit=crop",
							description: "Customer relationship management dashboard",
							width: 600,
							height: 380,
						},
						{
							value: "dashboard-8",
							label: "Social Media Dashboard",
							thumbnail_url:
								"https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=600&fit=crop",
							description: "Social media analytics dashboard",
							width: 400,
							height: 600,
						},
						{
							value: "dashboard-9",
							label: "Logistics Dashboard",
							thumbnail_url:
								"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=700&h=450&fit=crop",
							description: "Supply chain and logistics tracking",
							width: 700,
							height: 450,
						},
						{
							value: "dashboard-10",
							label: "Marketing Dashboard",
							thumbnail_url:
								"https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=400&h=580&fit=crop",
							description: "Marketing campaign performance dashboard",
							width: 400,
							height: 580,
						},
						{
							value: "dashboard-11",
							label: "Crypto Trading",
							thumbnail_url:
								"https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=650&h=400&fit=crop",
							description: "Cryptocurrency trading dashboard",
							width: 650,
							height: 400,
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
								"https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=600&fit=crop",
							description: "Creative portfolio showcase",
							width: 400,
							height: 600,
						},
						{
							value: "portfolio-2",
							label: "Designer Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1561070791-2526d30994b5?w=700&h=450&fit=crop",
							description: "UI/UX designer portfolio",
							width: 700,
							height: 450,
						},
						{
							value: "portfolio-3",
							label: "Photography Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=700&fit=crop",
							description: "Professional photography showcase",
							width: 400,
							height: 700,
						},
						{
							value: "portfolio-4",
							label: "Developer Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop",
							description: "Software developer project showcase",
							width: 600,
							height: 400,
						},
						{
							value: "portfolio-5",
							label: "Artist Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=650&fit=crop",
							description: "Digital artist gallery portfolio",
							width: 400,
							height: 650,
						},
						{
							value: "portfolio-6",
							label: "Architect Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=650&h=400&fit=crop",
							description: "Architecture project portfolio",
							width: 650,
							height: 400,
						},
						{
							value: "portfolio-7",
							label: "Illustrator Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=580&fit=crop",
							description: "Digital illustration portfolio",
							width: 400,
							height: 580,
						},
						{
							value: "portfolio-8",
							label: "Motion Designer",
							thumbnail_url:
								"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=700&h=450&fit=crop",
							description: "Motion graphics designer portfolio",
							width: 700,
							height: 450,
						},
						{
							value: "portfolio-9",
							label: "3D Artist",
							thumbnail_url:
								"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=600&fit=crop",
							description: "3D modeling and rendering portfolio",
							width: 400,
							height: 600,
						},
						{
							value: "portfolio-10",
							label: "Brand Designer",
							thumbnail_url:
								"https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&h=380&fit=crop",
							description: "Brand identity design portfolio",
							width: 600,
							height: 380,
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
								"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop",
							description: "Professional corporate website",
							width: 600,
							height: 400,
						},
						{
							value: "corporate-2",
							label: "Tech Company",
							thumbnail_url:
								"https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=520&fit=crop",
							description: "Technology company website",
							width: 400,
							height: 520,
						},
						{
							value: "corporate-3",
							label: "Consulting Firm",
							thumbnail_url:
								"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=700&h=450&fit=crop",
							description: "Business consulting firm website",
							width: 700,
							height: 450,
						},
						{
							value: "corporate-4",
							label: "Law Firm",
							thumbnail_url:
								"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=650&fit=crop",
							description: "Professional law firm website",
							width: 400,
							height: 650,
						},
						{
							value: "corporate-5",
							label: "Financial Services",
							thumbnail_url:
								"https://images.unsplash.com/photo-1560472355-536de3962603?w=650&h=400&fit=crop",
							description: "Financial services company website",
							width: 650,
							height: 400,
						},
						{
							value: "corporate-6",
							label: "Real Estate",
							thumbnail_url:
								"https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=580&fit=crop",
							description: "Real estate agency website",
							width: 400,
							height: 580,
						},
						{
							value: "corporate-7",
							label: "Insurance Company",
							thumbnail_url:
								"https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=380&fit=crop",
							description: "Insurance services corporate site",
							width: 600,
							height: 380,
						},
						{
							value: "corporate-8",
							label: "Healthcare Provider",
							thumbnail_url:
								"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=600&fit=crop",
							description: "Healthcare provider corporate website",
							width: 400,
							height: 600,
						},
						{
							value: "corporate-9",
							label: "Manufacturing",
							thumbnail_url:
								"https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=700&h=450&fit=crop",
							description: "Manufacturing company website",
							width: 700,
							height: 450,
						},
						{
							value: "corporate-10",
							label: "Logistics Company",
							thumbnail_url:
								"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=550&fit=crop",
							description: "Logistics and shipping company site",
							width: 400,
							height: 550,
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
								"https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=550&fit=crop",
							description: "Personal blog website",
							width: 400,
							height: 550,
						},
						{
							value: "personal-2",
							label: "Digital Resume",
							thumbnail_url:
								"https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=650&h=400&fit=crop",
							description: "Interactive resume website",
							width: 650,
							height: 400,
						},
						{
							value: "personal-3",
							label: "Writer's Site",
							thumbnail_url:
								"https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=600&fit=crop",
							description: "Author and writer personal site",
							width: 400,
							height: 600,
						},
						{
							value: "personal-4",
							label: "Coach Profile",
							thumbnail_url:
								"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=700&h=450&fit=crop",
							description: "Life coach personal website",
							width: 700,
							height: 450,
						},
						{
							value: "personal-5",
							label: "Freelancer Hub",
							thumbnail_url:
								"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=650&fit=crop",
							description: "Freelancer portfolio and contact site",
							width: 400,
							height: 650,
						},
						{
							value: "personal-6",
							label: "Vlogger Site",
							thumbnail_url:
								"https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&h=380&fit=crop",
							description: "Video content creator website",
							width: 600,
							height: 380,
						},
						{
							value: "personal-7",
							label: "Musician Profile",
							thumbnail_url:
								"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=580&fit=crop",
							description: "Musician and artist profile site",
							width: 400,
							height: 580,
						},
						{
							value: "personal-8",
							label: "Influencer Page",
							thumbnail_url:
								"https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=700&h=450&fit=crop",
							description: "Social media influencer website",
							width: 700,
							height: 450,
						},
						{
							value: "personal-9",
							label: "Chef Portfolio",
							thumbnail_url:
								"https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&h=600&fit=crop",
							description: "Professional chef portfolio site",
							width: 400,
							height: 600,
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
								"https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&h=400&fit=crop",
							description: "Modern blog design",
							width: 600,
							height: 400,
						},
						{
							value: "blog-2",
							label: "Tech Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=520&fit=crop",
							description: "Technology and programming blog",
							width: 400,
							height: 520,
						},
						{
							value: "blog-3",
							label: "Travel Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=700&h=450&fit=crop",
							description: "Travel and adventure blog",
							width: 700,
							height: 450,
						},
						{
							value: "blog-4",
							label: "Food Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=650&fit=crop",
							description: "Cooking and recipe blog",
							width: 400,
							height: 650,
						},
						{
							value: "blog-5",
							label: "Fashion Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1483985988355-763728e1935b?w=650&h=400&fit=crop",
							description: "Fashion and style blog",
							width: 650,
							height: 400,
						},
						{
							value: "blog-6",
							label: "Lifestyle Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&h=580&fit=crop",
							description: "Lifestyle and wellness blog",
							width: 400,
							height: 580,
						},
						{
							value: "blog-7",
							label: "Business Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&h=380&fit=crop",
							description: "Business and entrepreneurship blog",
							width: 600,
							height: 380,
						},
						{
							value: "blog-8",
							label: "Fitness Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=600&fit=crop",
							description: "Fitness and workout blog",
							width: 400,
							height: 600,
						},
						{
							value: "blog-9",
							label: "Parenting Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=700&h=450&fit=crop",
							description: "Parenting and family blog",
							width: 700,
							height: 450,
						},
						{
							value: "blog-10",
							label: "Photography Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&h=550&fit=crop",
							description: "Photography tips and showcase blog",
							width: 400,
							height: 550,
						},
						{
							value: "blog-11",
							label: "DIY Crafts Blog",
							thumbnail_url:
								"https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=650&h=400&fit=crop",
							description: "DIY and crafts tutorial blog",
							width: 650,
							height: 400,
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
								"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=400&fit=crop",
							description: "Casual mini game",
							width: 600,
							height: 400,
						},
						{
							value: "game-2",
							label: "Puzzle Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=400&h=700&fit=crop",
							description: "Brain teaser puzzle game",
							width: 400,
							height: 700,
						},
						{
							value: "game-3",
							label: "Arcade Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=700&h=450&fit=crop",
							description: "Retro arcade style game",
							width: 700,
							height: 450,
						},
						{
							value: "game-4",
							label: "Card Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1541278107931-e006523892df?w=400&h=520&fit=crop",
							description: "Online card game",
							width: 400,
							height: 520,
						},
						{
							value: "game-5",
							label: "Word Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=650&h=400&fit=crop",
							description: "Word puzzle and vocabulary game",
							width: 650,
							height: 400,
						},
						{
							value: "game-6",
							label: "Trivia Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=400&h=580&fit=crop",
							description: "Quiz and trivia game",
							width: 400,
							height: 580,
						},
						{
							value: "game-7",
							label: "Racing Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&h=380&fit=crop",
							description: "Fast-paced racing game",
							width: 600,
							height: 380,
						},
						{
							value: "game-8",
							label: "Strategy Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=600&fit=crop",
							description: "Turn-based strategy game",
							width: 400,
							height: 600,
						},
						{
							value: "game-9",
							label: "Match-3 Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=700&h=450&fit=crop",
							description: "Colorful match-3 puzzle game",
							width: 700,
							height: 450,
						},
						{
							value: "game-10",
							label: "Memory Game",
							thumbnail_url:
								"https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400&h=550&fit=crop",
							description: "Memory and concentration game",
							width: 400,
							height: 550,
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
								"https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&h=400&fit=crop",
							description: "Productivity tool interface",
							width: 600,
							height: 400,
						},
						{
							value: "tool-2",
							label: "Note Taking App",
							thumbnail_url:
								"https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=700&fit=crop",
							description: "Digital note-taking application",
							width: 400,
							height: 700,
						},
						{
							value: "tool-3",
							label: "Time Tracker",
							thumbnail_url:
								"https://images.unsplash.com/photo-1501139083538-0139583c060f?w=700&h=450&fit=crop",
							description: "Time tracking and analytics tool",
							width: 700,
							height: 450,
						},
						{
							value: "tool-4",
							label: "Calendar Planner",
							thumbnail_url:
								"https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=400&h=650&fit=crop",
							description: "Smart calendar and scheduling tool",
							width: 400,
							height: 650,
						},
						{
							value: "tool-5",
							label: "Kanban Board",
							thumbnail_url:
								"https://images.unsplash.com/photo-1557804506-669a67965ba0?w=650&h=400&fit=crop",
							description: "Visual project management board",
							width: 650,
							height: 400,
						},
						{
							value: "tool-6",
							label: "Habit Tracker",
							thumbnail_url:
								"https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=400&h=580&fit=crop",
							description: "Daily habit tracking application",
							width: 400,
							height: 580,
						},
						{
							value: "tool-7",
							label: "Pomodoro Timer",
							thumbnail_url:
								"https://images.unsplash.com/photo-1509966756634-9c23dd6e6815?w=600&h=380&fit=crop",
							description: "Focus and time management timer",
							width: 600,
							height: 380,
						},
						{
							value: "tool-8",
							label: "Mind Mapping",
							thumbnail_url:
								"https://images.unsplash.com/photo-1455849318743-b2233052fcff?w=400&h=600&fit=crop",
							description: "Visual mind mapping tool",
							width: 400,
							height: 600,
						},
						{
							value: "tool-9",
							label: "Goal Tracker",
							thumbnail_url:
								"https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=700&h=450&fit=crop",
							description: "Goal setting and tracking app",
							width: 700,
							height: 450,
						},
						{
							value: "tool-10",
							label: "Focus Timer",
							thumbnail_url:
								"https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=550&fit=crop",
							description: "Deep work focus timer",
							width: 400,
							height: 550,
						},
						{
							value: "tool-11",
							label: "Budget Tracker",
							thumbnail_url:
								"https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=650&h=400&fit=crop",
							description: "Personal finance budget tracker",
							width: 650,
							height: 400,
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
								"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=600&fit=crop",
							description: "2026 GLOBAL MARKET GROWTH REPORT",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
						{
							value: "cyber-puse",
							label: "Cyber Pulse",
							thumbnail_url:
								"https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=550&fit=crop",
							description: "AI-DRIVEN FUTURE HEALTHCARE SOLUTIONS",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 550,
						},
						{
							value: "earthly-breath",
							label: "Earthly Breath",
							thumbnail_url:
								"https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=400&h=700&fit=crop",
							description: "SUSTAINABLE FASHION & CIRCULAR ECONOMY INITIATIVE",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 700,
						},
						{
							value: "creative-collision",
							label: "Creative Collision",
							thumbnail_url:
								"https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=520&fit=crop",
							description: "SOCIAL MEDIA MARKETING STRATEGY FOR GEN Z",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 520,
						},
						{
							value: "classic-narrative",
							label: "Classic Narrative",
							thumbnail_url:
								"https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=650&fit=crop",
							description: "LUXURY BRAND GLOBAL EXPANSION ROADMAP",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 650,
						},
						{
							value: "industrial-backbone",
							label: "Industrial Backbone",
							thumbnail_url:
								"https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=400&h=580&fit=crop",
							description: "SMART MANUFACTURING & SUPPLY CHAIN OPTIMIZATION",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 580,
						},
						{
							value: "stable-capital",
							label: "Stable Capital",
							thumbnail_url:
								"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=600&fit=crop",
							description: "QUARTERLY HEDGE FUND PERFORMANCE ANALYSIS",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
						{
							value: "velocity-leap",
							label: "Velociy Leap",
							thumbnail_url:
								"https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=700&fit=crop",
							description: "THE FUTURE OF LOGISTICS & INSTANT DELIVERY",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 700,
						},
						{
							value: "life-seqence",
							label: "Life Sequence",
							thumbnail_url:
								"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=550&fit=crop",
							description: "GENE EDITING TECHNOLOGY RESEARCH REPORT",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 550,
						},
						{
							value: "nostalgic-byte",
							label: "Nostalgic Byte",
							thumbnail_url:
								"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=650&fit=crop",
							description: "INDIE GAME DEVELOPERS CONFERENCE KEYNOTE",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 650,
						},
						{
							value: "visual-bomb",
							label: "Visual Bomb",
							thumbnail_url:
								"https://images.unsplash.com/photo-1558769132-cb1aea1f1f57?w=400&h=520&fit=crop",
							description: "STREETWEAR BRAND COLLABORATION MARKETING",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 520,
						},
						{
							value: "geometric-order",
							label: "Geometric Order",
							thumbnail_url:
								"https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=400&h=600&fit=crop",
							description: "MODERN ARCHITECTURAL DESIGN PHILOSOPHY",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
						{
							value: "ink-flow",
							label: "Ink Flow",
							thumbnail_url:
								"https://images.unsplash.com/photo-1513569143478-b38b2c0ef97f?w=400&h=580&fit=crop",
							description: "Oriental Aesthetics in Modern Design",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 580,
						},
						{
							value: "nordic-dawn",
							label: "Nordic Dawn",
							thumbnail_url:
								"https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=700&fit=crop",
							description: "HOME OFFICE & MENTAL WELL-BEING GUIDE",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 700,
						},
						{
							value: "grained-memory",
							label: "Grained Memory",
							thumbnail_url:
								"https://images.unsplash.com/photo-1574267432644-f610c4ce5435?w=400&h=650&fit=crop",
							description: "ANNUAL INDIE FILM FESTIVAL REVIEW",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 650,
						},
						{
							value: "digital-transformation",
							label: "Digital Transformation",
							thumbnail_url:
								"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=550&fit=crop",
							description: "ENTERPRISE DIGITAL TRANSFORMATION STRATEGY",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 550,
						},
						{
							value: "green-energy",
							label: "Green Energy",
							thumbnail_url:
								"https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=600&fit=crop",
							description: "RENEWABLE ENERGY INVESTMENT OUTLOOK",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
						{
							value: "startup-pitch",
							label: "Startup Pitch",
							thumbnail_url:
								"https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=520&fit=crop",
							description: "SEED ROUND INVESTOR PITCH DECK",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 520,
						},
						{
							value: "education-future",
							label: "Education Future",
							thumbnail_url:
								"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=700&fit=crop",
							description: "FUTURE OF ONLINE LEARNING & EDTECH",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 700,
						},
						{
							value: "metaverse-vision",
							label: "Metaverse Vision",
							thumbnail_url:
								"https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=700&h=450&fit=crop",
							description: "METAVERSE & VIRTUAL REALITY FUTURE",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 700,
							height: 450,
						},
						{
							value: "space-tech",
							label: "Space Tech",
							thumbnail_url:
								"https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=580&fit=crop",
							description: "SPACE EXPLORATION TECHNOLOGY ROADMAP",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 580,
						},
						{
							value: "quantum-computing",
							label: "Quantum Computing",
							thumbnail_url:
								"https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=650&h=400&fit=crop",
							description: "QUANTUM COMPUTING BREAKTHROUGHS",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 650,
							height: 400,
						},
						{
							value: "smart-cities",
							label: "Smart Cities",
							thumbnail_url:
								"https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&h=600&fit=crop",
							description: "SMART CITY INFRASTRUCTURE PLANNING",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
						{
							value: "food-tech",
							label: "Food Tech",
							thumbnail_url:
								"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=380&fit=crop",
							description: "FUTURE OF FOOD & AGRICULTURE TECH",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 600,
							height: 380,
						},
						{
							value: "blockchain-future",
							label: "Blockchain Future",
							thumbnail_url:
								"https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=650&fit=crop",
							description: "BLOCKCHAIN & WEB3 INNOVATIONS",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 650,
						},
						{
							value: "cyber-security",
							label: "Cyber Security",
							thumbnail_url:
								"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=700&h=450&fit=crop",
							description: "CYBERSECURITY THREAT LANDSCAPE 2026",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 700,
							height: 450,
						},
						{
							value: "remote-work",
							label: "Remote Work",
							thumbnail_url:
								"https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=400&h=550&fit=crop",
							description: "FUTURE OF REMOTE WORK & COLLABORATION",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 550,
						},
						{
							value: "climate-action",
							label: "Climate Action",
							thumbnail_url:
								"https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=650&h=400&fit=crop",
							description: "CLIMATE CHANGE ACTION PLAN",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 650,
							height: 400,
						},
						{
							value: "ecommerce-trends",
							label: "E-commerce Trends",
							thumbnail_url:
								"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=600&fit=crop",
							description: "E-COMMERCE EVOLUTION & TRENDS",
							icon_url: "https://api.iconify.design/lucide/presentation.svg",
							width: 400,
							height: 600,
						},
					],
				},
			],
		},
	},
	{
		type: SkillPanelType.GUIDE,
		title: { zh_CN: "快速开始", en_US: "Quick Start" },
		guide: {
			items: [
				{
					key: "describe-design",
					title: { zh_CN: "描述设计灵感", en_US: "Describe Design Idea" },
					description: {
						zh_CN: "在输入框中描述你想要创建的图像或设计",
						en_US: "Describe the image or design you want to create in the input.",
					},
					icon: "Sparkles",
				},
				{
					key: "choose-style",
					title: { zh_CN: "选择风格与尺寸", en_US: "Choose Style & Size" },
					description: {
						zh_CN: "从下方选择尺寸、分辨率和风格模板",
						en_US: "Select size, resolution and style template from below.",
					},
					icon: "LayoutTemplate",
				},
				{
					key: "generate-design",
					title: { zh_CN: "一键生成", en_US: "Generate" },
					description: {
						zh_CN: "点击发送，AI 将根据描述生成设计图",
						en_US: "Click send and AI will generate the design based on your description.",
					},
					icon: "Image",
				},
			],
		},
	},
]

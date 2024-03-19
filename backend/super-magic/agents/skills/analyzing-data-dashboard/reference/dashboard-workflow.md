# 数据分析看板项目开发流程 / Dashboard Project Workflow

<!--zh
数据分析看板项目开发：

看板步骤说明：
* 项目识别：理解用户需求，识别目标项目
* 创建项目：必须通过调用`create_dashboard_project(name="PROJECT_NAME", sources=[...])`创建看板项目，识别数据源后传入sources参数，接下来的工作在该项目目录内进行
* 卡片规划：创建"cards_todo.md"卡片规划文档
* 数据清洗：按照"cards_todo.md"文档内容以及数据目的，在项目内创建并执行data_cleaning.py脚本，为看板开发提供数据支持
* 看板编辑：根据需求修改相应文件
* 看板开发：按照"cards_todo.md"文档内容使用卡片管理工具（create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards、query_dashboard_cards）创建卡片
* 校验看板：调用`validate_dashboard(project_path="PROJECT_NAME")`校验看板，如有错误或警告必须修复后重新校验直至没有错误和警告为止（严禁删除卡片）
* 完成交付：提供项目总结和数据分析结果并结束任务
* 标记数据源：创建项目时通过create_dashboard_project的sources参数传入，自动写入；编辑现有项目时需手动更新magic.project.js中的sources数组

看板步骤：
* 创建新看板：创建项目→卡片规划→数据清洗→看板开发→校验看板→完成交付
* 编辑现有看板：项目识别→数据清洗(按需)→看板编辑→校验看板→标记数据源(按需)→完成交付

看板开发核心原则：
* 严格遵循看板步骤一步一步完成看板开发
* 必须要完成校验看板才能交付任务，否则页面无法正常访问

看板开发偏好：
* 卡片建议设置title(指标卡片除外，因为会与指标label重复)
* 合理规划卡片类型，优先使用ECharts卡片展示数据
* 卡片标准尺寸示例(基于24列栅格)：指标卡{w:4,h:3}、图表卡{w:8,h:8}、表格卡{w:12,h:8}、Markdown卡{w:12,h:(根据content计算高度)}
* 新建看板卡片数量标准：根据数据维度和业务需求合理配置，建议指标卡片≥6个、echarts卡片28~32个、表格卡片2~3个(其中需包含明细数据表)、markdown卡片0个
-->

Data Analysis Dashboard Project Development:

Dashboard Step Description:

- Project identification: Understand user needs, identify target project
- Create project: Must call `create_dashboard_project(name="PROJECT_NAME", sources=[...])` to create dashboard project, pass identified data sources via sources param, subsequent work proceeds within that project directory
- Card planning: Create "cards_todo.md" card planning document
- Data cleaning: According to "cards_todo.md" document content and data purpose, create and execute data_cleaning.py script within project to provide data support for dashboard development
- Dashboard editing: Modify corresponding files according to needs
- Dashboard development: Add cards using card management tools (create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards、query_dashboard_cards)
- Validate dashboard: Call `validate_dashboard(project_path="PROJECT_NAME")` to validate dashboard, if errors or warnings exist must fix and re-validate until no errors or warnings (strictly prohibited to delete cards)
- Complete delivery: Provide project summary and data analysis results and end task
- Mark data source: When creating project pass sources to create_dashboard_project (auto-written); when editing existing project manually update sources array in magic.project.js

Dashboard Steps:

- Create new dashboard: Create project → Card planning → Data cleaning → Dashboard development → Validate dashboard → Complete delivery
- Edit existing dashboard: Project identification → Data cleaning (as needed) → Dashboard editing → Validate dashboard → Mark data source (as needed) → Complete delivery

Dashboard Development Core Principles:

- Strictly follow dashboard steps to complete dashboard development step by step
- Must complete dashboard validation before delivery, otherwise page cannot be accessed normally

Dashboard Development Preferences:

- Cards suggest setting title (except metric cards, as they duplicate with metric label)
- Reasonably plan card types, prioritize using ECharts cards to display data
- Card standard size examples (based on 24-column grid): Metric card {w:4,h:3}, Chart card {w:8,h:8}, Table card {w:12,h:8}, Markdown card {w:12,h:(calculate height based on content)}
- New dashboard card quantity standard: Configure reasonably based on data dimensions and business needs, suggest metric cards ≥6, echarts cards 28~32, table cards 2~3 (must include detail data table), markdown cards 0

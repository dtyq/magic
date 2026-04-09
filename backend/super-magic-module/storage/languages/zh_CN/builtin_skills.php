<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        'analyzing-data-dashboard' => '数据分析看板',
        'analyzing-data-html-report' => '数据分析报告',
        'im-channels' => '连接 IM 机器人',
        'creating-slides' => '创建幻灯片',
        'crew-creator' => '智能体配置管理',
        'data-qa' => '数据问答',
        'deep-research' => '深度研究',
        'canvas-designer' => '画布设计',
        'skill-creator' => '技能创建',
    ],
    'descriptions' => [
        'analyzing-data-dashboard' => '数据分析看板开发技能。当用户需要开发数据看板、创建或编辑看板项目、构建数据可视化看板，或为看板进行数据清洗时使用。包含看板项目创建（支持通过 sources 参数自动标记数据源）、卡片规划、数据清洗（data_cleaning.py）、卡片管理工具（create_dashboard_cards、update_dashboard_cards、delete_dashboard_cards、query_dashboard_cards）、地图下载工具（download_dashboard_maps）、看板开发、校验以及数据源标记（magic.project.js 的 sources 数组）。',
        'analyzing-data-html-report' => '数据分析报告开发技能。当用户需要开发数据分析报告、创建分析报告项目、构建静态 HTML 分析文档，或生成一次性的可视化分析报告时使用。',
        'im-channels' => '配置和连接 IM 渠道机器人（企业微信、钉钉、飞书）。当用户提到「配置机器人」「接入企微/钉钉/飞书」「连接到 IM」「设置机器人」等相关需求时使用。',
        'creating-slides' => '幻灯片/PPT 创建技能，提供完整的幻灯片创建、编辑和管理能力。当用户需要创建幻灯片、制作演示文稿、编辑幻灯片内容或管理幻灯片项目时使用。重要：当用户消息中包含 [@slide_project:...] 提及时，必须在执行任何操作前优先加载此技能。',
        'crew-creator' => '用于管理和优化自定义 Agent 定义文件（IDENTITY.md、AGENTS.md、SOUL.md、TOOLS.md）。当用户想要编辑 Agent 身份、修改工作流说明、调整性格、增删工具或优化提示词时使用。触发信号包括：“modify prompt”“change identity”“add tool”“remove tool”“optimize workflow”“adjust personality”“修改提示词”“改身份”“加工具”“去掉工具”“优化能力”“调性格”。不要用于：技能创建（请使用 skill-creator）、技能列表查询（请使用 find-skill）。',
        'data-qa' => '数据问答技能，用于快速给出数字答案和结论。当用户询问“xx 指标是多少”“哪个 xx 最好”“xx 增长率怎么样”这类问题，或需要基于数据立即得到数字答案/结论时使用。答案仅基于 Python 脚本计算。',
        'deep-research' => '适用于需要多来源检索、交叉验证和综合结论的研究任务。关键词信号包括：research、deep research、deep dive、analysis、investigate、report、survey、industry analysis、competitive analysis、market analysis。以下场景触发：(1) 主题需要来自多个来源的最新、可验证数据，例如新闻、市场分析、竞争格局、行业研究；(2) 用户对现有回答深度不满意。若单次搜索或模型已有知识即可满足，则跳过。',
        'canvas-designer' => 'Canvas（画布）项目管理技能，提供 AI 图片生成、网页图片搜索和设计标记处理能力。会在所有图片生成任务中自动使用，用于统一组织和管理图片。支持图生图生成与设计标记处理。仅当用户明确要求不要使用画布，或操作对象是在网页、PPT 等其他应用中的图片时才跳过。重要：当用户消息中包含 [@design_canvas_project:...] 或 [@design_marker:...] 提及时，必须在执行任何操作前优先加载此技能。',
        'skill-creator' => '用于创建新技能、修改和优化已有技能，以及评估技能表现。当用户想从零创建技能、编辑或优化已有技能、运行评测验证技能效果、基准测试技能性能，或优化技能描述以提升触发准确率时使用。用户表达“把这个流程沉淀成技能”“为 X 做一个技能”或“把这个做成可复用技能”时也应使用。',
    ],
];

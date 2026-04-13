<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        'analyzing-data-dashboard' => '数据分析看板',
        'analyzing-data-html-report' => '数据分析报告',
        'connecting-im-bot' => '连接 IM 机器人',
        'creating-slides' => '创建幻灯片',
        'crew-creator' => '智能体配置管理',
        'data-qa' => '数据问答',
        'deep-research' => '深度研究',
        'canvas-designer' => '画布设计',
        'env-manager' => '环境变量管理',
        'find-skill' => '技能发现',
        'skill-creator' => '技能创建',
        'standardizing-st-quotation' => '报价单标准化',
        'using-cron' => '定时任务',
        'using-llm' => 'LLM 调用',
        'using-mcp' => 'MCP 调用',
    ],
    'descriptions' => [
        'analyzing-data-dashboard' => 'Data analysis dashboard development skill. Use when users need to develop data dashboards, create/edit dashboard projects, build data visualization boards, or perform data cleaning for dashboards. Includes dashboard project creation (with sources parameter for auto-marking data sources), card planning, data cleaning (data_cleaning.py), card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards), map download tool (download_dashboard_maps), dashboard development, validation, and data source marking (magic.project.js sources array).',
        'analyzing-data-html-report' => 'Data analysis report development skill. Use when users need to develop data analysis reports, create analysis report projects, build static HTML analysis documents, or produce one-time analysis reports with visualization.',
        'connecting-im-bot' => '配置和连接 IM 渠道机器人（企业微信、钉钉、飞书）。当用户提到「配置机器人」「接入企微/钉钉/飞书」「连接到 IM」「设置机器人」等相关需求时使用。',
        'creating-slides' => 'Slide/PPT creation skill that provides complete slide creation, editing, and management capabilities. Use when users need to create slides, make presentations, edit slide content, or manage slide projects. CRITICAL - When user message contains [@slide_project:...] mention, you MUST load this skill first before any operations.',
        'crew-creator' => 'Manage and optimize custom agent definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md). Use when users want to edit agent identity, modify workflow instructions, adjust personality, add/remove tools, or optimize prompts. Trigger signals: "modify prompt", "change identity", "add tool", "remove tool", "optimize workflow", "adjust personality", "修改提示词", "改身份", "加工具", "去掉工具", "优化能力", "调性格". Do NOT use for: skill creation (use skill-creator), skill listing (use find-skill).',
        'data-qa' => 'Data Q&A skill for immediate numeric answers and conclusions. Use when users ask "what is xx metric?", "which xx is best?", "how is xx growth rate?" or need instant numeric answers/conclusions from data. Answers based on Python script calculation only.',
        'deep-research' => 'For research tasks that need multi-source retrieval, cross-validation, and synthesized conclusions. Keyword signals: research, deep research, deep dive, analysis, investigate, report, survey, industry analysis, competitive analysis, market analysis. Trigger when: (1) the topic requires current, verifiable data from multiple sources - news, market analysis, competitive landscape, industry research; (2) the user is unsatisfied with the depth of an existing answer. Skip when a single search or model recall suffices.',
        'canvas-designer' => 'Core canvas design skill covering project management, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, or when the user wants to generate video/animation/clip on a canvas project, you MUST load this skill first before any operations.',
        'env-manager' => 'Manage persistent environment variables. Use when the user provides API keys or other configuration values that need to be saved and reused across sessions.',
        'find-skill' => 'Search and install skills from the internet using the skillhub CLI. Use when user wants to expand agent capabilities with third-party skills, or asks to find/install a skill from the internet.',
        'skill-creator' => 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or optimize a skill\'s description for better triggering accuracy. Also use when user asks to "capture this workflow as a skill", "make a skill for X", or "turn this into a reusable skill".',
        'standardizing-st-quotation' => 'Standardize heterogeneous quotation sheets into the required schema for st_batch_quotation_processor, then run batch quotation processing with built-in default data sources (price database + CNAS calibration/testing docs) so users only need to provide quotation sheet files.',
        'using-cron' => 'Manage scheduled tasks - create, query, update, and delete. CRITICAL - When user message contains any future time intent (e.g. "in 2 days", "tomorrow at 8am", "every morning"), you MUST load this skill first. NEVER write custom scheduler scripts.',
        'using-llm' => 'List available large language models and send chat completion requests programmatically. Use this skill when you need to call an LLM within a snippet, including model comparison, visual understanding, batch inference, and model performance testing.',
        'using-mcp' => 'Query MCP servers, list available MCP tools, get tool schemas, and call MCP tools programmatically. CRITICAL - When user message contains [@mcp:...] mention, you MUST load this skill first to properly use MCP tools.',
    ],
];

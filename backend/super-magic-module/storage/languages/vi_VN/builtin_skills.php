<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        'analyzing-data-dashboard' => 'Data Dashboard Analysis',
        'analyzing-data-html-report' => 'Data HTML Report Analysis',
        'connecting-im-bot' => 'Connect IM Bot',
        'creating-slides' => 'Create Slides',
        'crew-creator' => 'Crew Creator',
        'data-qa' => 'Data Q&A',
        'deep-research' => 'Deep Research',
        'designing-canvas-images' => 'Canvas Image Design',
        'env-manager' => 'Environment Manager',
        'find-skill' => 'Find Skill',
        'skill-creator' => 'Skill Creator',
        'standardizing-st-quotation' => 'ST Quotation Standardization',
        'using-cron' => 'Use Cron',
        'using-llm' => 'Use LLM',
        'using-mcp' => 'Use MCP',
    ],
    'descriptions' => [
        'analyzing-data-dashboard' => 'Data analysis dashboard development skill. Use when users need to develop data dashboards, create/edit dashboard projects, build data visualization boards, or perform data cleaning for dashboards. Includes dashboard project creation (with sources parameter for auto-marking data sources), card planning, data cleaning (data_cleaning.py), card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards), map download tool (download_dashboard_maps), dashboard development, validation, and data source marking (magic.project.js sources array).',
        'analyzing-data-html-report' => 'Data analysis report development skill. Use when users need to develop data analysis reports, create analysis report projects, build static HTML analysis documents, or produce one-time analysis reports with visualization.',
        'connecting-im-bot' => 'Configure and connect IM channel bots (WeCom, DingTalk, Feishu). Use when users mention needs like "configure bot", "connect to WeCom/DingTalk/Feishu", "connect to IM", or "set up bot".',
        'creating-slides' => 'Slide/PPT creation skill that provides complete slide creation, editing, and management capabilities. Use when users need to create slides, make presentations, edit slide content, or manage slide projects. CRITICAL - When user message contains [@slide_project:...] mention, you MUST load this skill first before any operations.',
        'crew-creator' => 'Manage and optimize custom agent definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md). Use when users want to edit agent identity, modify workflow instructions, adjust personality, add/remove tools, or optimize prompts. Trigger signals: "modify prompt", "change identity", "add tool", "remove tool", "optimize workflow", "adjust personality", "修改提示词", "改身份", "加工具", "去掉工具", "优化能力", "调性格". Do NOT use for: skill creation (use skill-creator), skill listing (use find-skill).',
        'data-qa' => 'Data Q&A skill for immediate numeric answers and conclusions. Use when users ask "what is xx metric?", "which xx is best?", "how is xx growth rate?" or need instant numeric answers/conclusions from data. Answers based on Python script calculation only.',
        'deep-research' => 'For research tasks that need multi-source retrieval, cross-validation, and synthesized conclusions. Keyword signals: research, deep research, deep dive, analysis, investigate, report, survey, industry analysis, competitive analysis, market analysis. Trigger when: (1) the topic requires current, verifiable data from multiple sources - news, market analysis, competitive landscape, industry research; (2) the user is unsatisfied with the depth of an existing answer. Skip when a single search or model recall suffices.',
        'designing-canvas-images' => 'Canvas (画布) project management skill providing AI image generation, web image search, and design marker processing. Automatically used for all image generation tasks to organize and manage images. Supports image-to-image generation and design marker processing. Skip canvas only when users explicitly request without canvas or when operating on images in other applications like webpages or PPT. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, you MUST load this skill first before any operations.',
        'env-manager' => 'Manage persistent environment variables. Use when the user provides API keys or other configuration values that need to be saved and reused across sessions.',
        'find-skill' => 'Search and install skills from the internet using the skillhub CLI. Use when user wants to expand agent capabilities with third-party skills, or asks to find/install a skill from the internet.',
        'skill-creator' => 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or optimize a skill\'s description for better triggering accuracy. Also use when user asks to "capture this workflow as a skill", "make a skill for X", or "turn this into a reusable skill".',
        'standardizing-st-quotation' => 'Standardize heterogeneous quotation sheets into the required schema for st_batch_quotation_processor, then run batch quotation processing with built-in default data sources (price database + CNAS calibration/testing docs) so users only need to provide quotation sheet files.',
        'using-cron' => 'Manage scheduled tasks - create, query, update, and delete. CRITICAL - When user message contains any future time intent (e.g. "in 2 days", "tomorrow at 8am", "every morning"), you MUST load this skill first. NEVER write custom scheduler scripts.',
        'using-llm' => 'List available large language models and send chat completion requests programmatically. Use this skill when you need to call an LLM within a snippet, including model comparison, visual understanding, batch inference, and model performance testing.',
        'using-mcp' => 'Query MCP servers, list available MCP tools, get tool schemas, and call MCP tools programmatically. CRITICAL - When user message contains [@mcp:...] mention, you MUST load this skill first to properly use MCP tools.',
    ],
];

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
        'skill-creator' => 'Skill Creator',
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
        'skill-creator' => 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or optimize a skill\'s description for better triggering accuracy. Also use when user asks to "capture this workflow as a skill", "make a skill for X", or "turn this into a reusable skill".',
    ],
];

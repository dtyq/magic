<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'names' => [
        'develop-data-analysis-dashboard' => 'Data analysis dashboard development',
        'im-channels' => 'Connect IM Bot',
        'creating-slides' => 'Create Slides',
        'crew-creator' => 'Crew Creator',
        'deep-research' => 'Deep Research',
        'canvas-designer' => 'Canvas Designer',
        'skill-creator' => 'Skill Creator',
    ],
    'descriptions' => [
        'develop-data-analysis-dashboard' => 'Develop data analysis dashboards. Use when users need to develop data dashboards, create/edit dashboard projects, build data visualization boards, or perform data cleaning for dashboards. Includes dashboard project creation (with sources parameter for auto-marking data sources), card planning, data cleaning script guidance, card management tools (create_dashboard_cards, update_dashboard_cards, delete_dashboard_cards, query_dashboard_cards), map download tool (download_dashboard_maps), dashboard development, validation, and data source marking (magic.project.js sources array). Data cleaning outputs must be CSV files under cleaned_data.',
        'im-channels' => 'Configure and connect IM channel bots (WeCom, DingTalk, Feishu). Use when users mention needs like "configure bot", "connect to WeCom/DingTalk/Feishu", "connect to IM", or "set up bot".',
        'creating-slides' => 'Slide/PPT creation skill that provides complete slide creation, editing, and management capabilities. Use when users need to create slides, make presentations, edit slide content, or manage slide projects. CRITICAL - When user message contains [@slide_project:...] mention, you MUST load this skill first before any operations.',
        'crew-creator' => 'Manage and optimize custom agent definition files (IDENTITY.md, AGENTS.md, SOUL.md, TOOLS.md). Use when users want to edit agent identity, modify workflow instructions, adjust personality, add/remove tools, or optimize prompts. Trigger signals: "modify prompt", "change identity", "add tool", "remove tool", "optimize workflow", "adjust personality", "修改提示词", "改身份", "加工具", "去掉工具", "优化能力", "调性格". Do NOT use for: skill creation (use skill-creator), skill listing (use find-skill).',
        'deep-research' => 'For research tasks that need multi-source retrieval, cross-validation, and synthesized conclusions. Keyword signals: research, deep research, deep dive, analysis, investigate, report, survey, industry analysis, competitive analysis, market analysis. Trigger when: (1) the topic requires current, verifiable data from multiple sources - news, market analysis, competitive landscape, industry research; (2) the user is unsatisfied with the depth of an existing answer. Skip when a single search or model recall suffices.',
        'canvas-designer' => 'Core canvas design skill covering project management, multimedia principles, AI image generation, web image search, and design marker processing. Load for any canvas design task. CRITICAL - When user message contains [@design_canvas_project:...] or [@design_marker:...] mentions, or when the user wants to generate video/animation/clip on a canvas project, you MUST load this skill first before any operations.',
        'skill-creator' => 'Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit or optimize an existing skill, run evals to test a skill, benchmark skill performance, or optimize a skill\'s description for better triggering accuracy. Also use when user asks to "capture this workflow as a skill", "make a skill for X", or "turn this into a reusable skill".',
    ],
];

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 向量搜索总开关，叠加在原有「向量搜索 AI 能力」之上：
    // 仅当 KnowledgeBaseEmbeddingModel 已启用 且 本开关打开时向量搜索才生效。
    // 默认开启（行为与改造前一致）；显式关掉后各市场检索回落关键词搜索。
    'enabled' => (bool) env('VECTOR_INDEX_ENABLED', true),

    // 向量数据库不可用时的短缓存时间，避免每次请求都重复探测服务。
    'availability_cache_seconds' => (int) env('VECTOR_INDEX_AVAILABILITY_CACHE_SECONDS', 60),

    // 各业务索引参数；Collection 维度由 Embedding 实际输出自动确定。
    'resources' => [
        'slides_template' => [
            'collection' => (string) env('SLIDES_TEMPLATE_VECTOR_COLLECTION', 'slides_templates'),
            'score_threshold' => (float) env('SLIDES_TEMPLATE_VECTOR_SCORE_THRESHOLD', 0.4),
        ],
        'skill_market' => [
            'collection' => (string) env('SKILL_MARKET_VECTOR_COLLECTION', 'skill_markets'),
            'score_threshold' => (float) env('SKILL_MARKET_VECTOR_SCORE_THRESHOLD', 0.4),
        ],
        'agent_market' => [
            'collection' => (string) env('AGENT_MARKET_VECTOR_COLLECTION', 'agent_markets'),
            'score_threshold' => (float) env('AGENT_MARKET_VECTOR_SCORE_THRESHOLD', 0.4),
        ],
    ],
];

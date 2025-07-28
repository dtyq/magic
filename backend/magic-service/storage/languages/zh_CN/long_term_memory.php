<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => '长期记忆操作失败',
    'prompt_file_not_found' => '提示词文件未找到：:path',
    'not_found' => '记忆不存在',
    'creation_failed' => '记忆创建失败',
    'update_failed' => '记忆更新失败',
    'deletion_failed' => '记忆删除失败',
    'evaluation' => [
        'llm_request_failed' => '记忆评估请求失败',
        'llm_response_parse_failed' => '记忆评估响应解析失败',
        'score_parse_failed' => '记忆评估分数解析失败',
    ],
    'entity' => [
        'content_too_long' => '记忆内容长度不能超过65535个字符',
        'pending_content_too_long' => '待变更记忆内容长度不能超过65535个字符',
        'enabled_status_restriction' => '只有已生效状态的记忆才能启用或禁用',
        'user_memory_limit_exceeded' => '用户记忆数量已达到上限（20条）',
    ],
    'api' => [
        'validation_failed' => '参数验证失败：:errors',
        'memory_not_belong_to_user' => '记忆不存在或无权限访问',
        'partial_memory_not_belong_to_user' => '部分记忆不存在或无权限访问',
        'accept_memories_failed' => '批量接受记忆建议失败：:error',
    ],
];

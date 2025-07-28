<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => '处理长期记忆时发生未知错误。',
    'prompt_file_not_found' => '长期记忆评估所需的提示文件不存在。',
    'evaluation' => [
        'llm_request_failed' => '请求语言模型进行记忆评估时失败。',
        'llm_response_parse_failed' => '解析语言模型的记忆评估响应时失败。',
        'score_parse_failed' => '从语言模型的响应中解析记忆评分失败。',
    ],
    'not_found' => '指定的记忆不存在。',
    'creation_failed' => '创建新记忆失败。',
    'update_failed' => '更新记忆失败。',
    'deletion_failed' => '删除记忆失败。',
];

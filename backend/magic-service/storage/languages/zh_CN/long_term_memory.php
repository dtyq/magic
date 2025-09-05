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
    'enabled_memory_limit_exceeded' => '启用记忆数量超过限制',
    'memory_category_limit_exceeded' => ':category最多只能启用 :limit 个',
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
        'memory_created_successfully' => '记忆创建成功',
        'memory_updated_successfully' => '记忆更新成功',
        'memory_deleted_successfully' => '记忆删除成功',
        'memory_reinforced_successfully' => '记忆强化成功',
        'memories_batch_reinforced_successfully' => '记忆批量强化成功',
        'memories_accepted_successfully' => '成功接受 :count 条记忆建议',
        'memories_rejected_successfully' => '成功拒绝 :count 条记忆建议',
        'batch_process_memories_failed' => '批量处理记忆建议失败',
        'batch_action_memories_failed' => '批量:action记忆建议失败：:error',
        'user_manual_edit_explanation' => '用户手动修改记忆内容',
        'content_auto_compressed_explanation' => '内容过长，已自动压缩',
        'parameter_validation_failed' => '参数验证失败: :errors',
        'action_accept' => '接受',
        'action_reject' => '拒绝',
        'content_length_exceeded' => '内容长度不能超过5000个字符',
    ],
];

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'open_api' => [
        'invalid_text_content' => '纯文本模式需要非空 content，且不能同时提供 rich_content',
        'content_conflict' => '富文本模式请只使用 rich_content，不要同时提供 content 或 file_ids',
        'configuration_conflict' => '富文本配置请放在 rich_content.extra.super_agent 中',
        'invalid_content_type' => 'content_type 仅支持 text 或 rich_text',
        'invalid_file_ids' => 'file_ids 必须是有效文件 ID 的列表',
        'invalid_rich_content' => '富文本 content 必须是有效的 Tiptap doc JSON 字符串',
        'invalid_file_reference' => '引用文件不存在、无权限或文件类型不匹配',
        'create_messages_only' => '创建任务仅支持普通消息和追问，不支持中断或工具回复',
        'invalid_tool_reply' => '工具回复格式无效',
    ],
    'invalid' => '参数不合法',
    'not_found' => '任务未找到',
    'already_exists' => '相同名字和类型的任务已存在',
    'create_failed' => '任务创建失败',
    'update_failed' => '任务更新失败',
    'delete_failed' => '任务删除失败',
    'list_failed' => '任务列表获取失败',
    'get_failed' => '任务获取失败',
    'task_not_found' => '任务不存在',
    'access_denied' => '您没有权限访问此任务',
    'agent_id_required' => 'agentId 不能为空',
    'topic_id_required' => 'topicId 不能为空',
    'work_dir_not_found' => '工作目录未找到',
    'continue' => '继续',
    'initialize_error' => '当前系统繁忙，请稍后重试。',
    'agent_stopped' => '任务已终止',
    'finished_task_action' => '已完成结果文件的输出',
    'access_token_not_found' => '访问令牌未找到',
    'id_required' => '参数不能为空',

    'access_token' => [
        'not_found' => '资源不存在',
    ],
    'create_workspace_version_failed' => '操作失败',
];

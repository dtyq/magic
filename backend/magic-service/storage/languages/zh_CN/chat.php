<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'user_call_agent_fail_notice' => '不好意思，刚才处理有些异常，你可以换种表述重新问一下哦，以便我能准确为你解答',
    ],
    'message' => [
        'not_found' => '消息未找到',
        'send_failed' => '消息发送失败',
        'type_error' => '消息类型错误',
        'delivery_failed' => '消息投递失败',
        'stream' => [
            'type_not_support' => '流式消息不支持该消息类型',
        ],
        'voice' => [
            'attachment_required' => '语音消息必须包含一个音频附件',
            'single_attachment_only' => '语音消息只能包含一个附件，当前附件数量：:count',
            'attachment_empty' => '语音消息附件不能为空',
            'audio_format_required' => '语音消息的附件必须是音频格式，当前类型：:type',
            'duration_positive' => '语音时长必须大于0秒，当前时长：:duration 秒',
            'duration_exceeds_limit' => '语音时长不能超过:max_duration 秒，当前时长：:duration 秒',
        ],
        'rollback' => [
            'seq_id_not_found' => '消息序列ID不存在',
            'magic_message_id_not_found' => '关联的消息ID不存在',
        ],
    ],
    'already_exist' => '已存在',
    'not_found' => '未找到',
    'ai' => [
        'not_found' => '助理未找到',
    ],
    'conversation' => [
        'type_error' => '会话类型错误',
        'not_found' => '会话不存在',
        'deleted' => '会话已被删除',
        'organization_code_empty' => '会话组织代码为空',
    ],
    'common' => [
        'param_error' => '参数 :param 错误',
    ],
    'seq' => [
        'id_error' => '消息序列 ID 错误',
        'not_found' => '消息序列不存在',
    ],
    'user' => [
        'no_organization' => '用户无组织',
        'receive_not_found' => '收件方不存在',
        'not_found' => '用户不存在',
        'not_create_account' => '用户尚未创建账号',
        'sync_failed' => '用户同步失败',
    ],
    'data' => [
        'write_failed' => '数据写入失败',
    ],
    'context' => [
        'lost' => '请求上下文丢失',
    ],
    'refer_message' => [
        'not_found' => '引用消息未找到',
    ],
    'topic' => [
        'not_found' => '话题未找到',
        'message' => [
            'not_found' => '话题的消息未找到',
        ],
        'send_message_and_rename_topic' => '请发送消息后再尝试智能重命名话题',
        'id_not_found' => '话题 ID 未找到',
        'system_default_topic' => '系统默认话题',
    ],
    'group' => [
        'user_select_error' => '群聊人员选择异常',
        'user_num_limit_error' => '群聊人数超出限制',
        'create_error' => '群聊创建失败',
        'not_found' => '群聊不存在',
        'user_already_in_group' => '所有用户已经在群中',
        'update_error' => '群信息更新失败',
        'no_user_to_remove' => '没有用户可以从群聊中移除',
        'cannot_kick_owner' => '不能踢出群主',
        'transfer_owner_before_leave' => '请先转让群主再退出群聊',
        'only_owner_can_disband' => '只有群主才能解散群聊',
        'only_owner_can_transfer' => '只有群主才能转让群组',
    ],
    'department' => [
        'not_found' => '部门不存在',
        'sync_not_support' => '不支持同步这个第三方平台的部门数据',
        'sync_failed' => '部门同步失败',
    ],
    'login' => [
        'failed' => '登录失败',
    ],
    'operation' => [
        'failed' => '操作失败',
    ],
    'file' => [
        'not_found' => '消息中的文件不存在',
    ],
    'platform' => [
        'organization_code_not_found' => '平台组织代码未找到',
        'organization_env_not_found' => '平台组织环境未找到',
    ],
    'magic' => [
        'environment_config_error' => '麦吉环境配置错误',
        'environment_not_found' => '麦吉环境未找到',
        'ticket_not_found' => '麦吉 appTicket 未找到',
    ],
    'authorization' => [
        'invalid' => 'authorization 不合法',
    ],
    'stream' => [
        'sequence_id_not_found' => '流式消息序列未找到',
        'message_not_found' => '流式消息未找到',
        'receive_message_id_not_found' => '流式消息的接收方消息 ID 未找到',
    ],

];

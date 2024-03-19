<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'common' => [
        'param_error' => ':param is invalid',
    ],
    'already_exist' => 'Already exists',
    'not_found' => 'Not found',
    'topic' => [
        // 请发送消息后再尝试智能重命名话题
        'send_message_and_rename_topic' => 'Please send a message before trying to rename the topic intelligently',
        // 系统默认话题
        'system_default_topic' => 'System default topic',
    ],
    'agent' => [
        // 不好意思，刚才处理有些异常，你可以换种表述重新问一下哦，以便我能准确为你解答
        'user_call_agent_fail_notice' => 'Sorry, there was a bit of an exception in the processing just now, you can rephrase and ask again so that I can answer you accurately',
    ],
    'message' => [
        'not_found' => 'Message not found',
        'send_failed' => 'Message send failed',
        'type_error' => 'Message type error',
        'delivery_failed' => 'Message delivery failed',
        'stream' => [
            'type_not_support' => 'The message type is not supported for stream messages',
        ],
        'voice' => [
            'attachment_required' => 'Voice message must contain an audio attachment',
            'single_attachment_only' => 'Voice message can only contain one attachment, current count: :count',
            'attachment_empty' => 'Voice message attachment cannot be empty',
            'audio_format_required' => 'Voice message attachment must be audio format, current type: :type',
            'duration_positive' => 'Voice duration must be greater than 0 seconds, current duration: :duration seconds',
            'duration_exceeds_limit' => 'Voice duration cannot exceed :max_duration seconds, current duration: :duration seconds',
        ],
        'rollback' => [
            'seq_id_not_found' => 'Message sequence ID not found',
            'magic_message_id_not_found' => 'Associated message ID not found',
        ],
    ],
    'ai' => [
        'not_found' => 'Agent not found',
    ],
    'conversation' => [
        'type_error' => 'Conversation type error',
        'not_found' => 'Conversation not found',
        'deleted' => 'Conversation deleted',
        'organization_code_empty' => 'Conversation organization code is empty',
    ],
    'seq' => [
        'id_error' => 'Message sequence ID error',
        'not_found' => 'Message sequence not found',
    ],
    'user' => [
        'no_organization' => 'User has no organization',
        'receive_not_found' => 'Receiver not found',
        'not_found' => 'User not found',
        'not_create_account' => 'User has not created an account',
        'sync_failed' => 'User sync failed',
    ],
    'data' => [
        'write_failed' => 'Data write failed',
    ],
    'context' => [
        'lost' => 'Request context lost',
    ],
    'refer_message' => [
        'not_found' => 'Referenced message not found',
    ],
    'group' => [
        'user_select_error' => 'Group member selection error',
        'user_num_limit_error' => 'Group size exceeds limit',
        'create_error' => 'Group creation failed',
        'not_found' => 'Group not found',
        'user_already_in_group' => 'All users are already in the group',
        'update_error' => 'Group update failed',
        'no_user_to_remove' => 'No users to remove from group',
        'cannot_kick_owner' => 'Cannot remove group owner',
        'transfer_owner_before_leave' => 'Transfer ownership before leaving the group',
        'only_owner_can_disband' => 'Only group owner can disband the group',
        'only_owner_can_transfer' => 'Only group owner can transfer the group',
    ],
    'department' => [
        'not_found' => 'Department not found',
        'sync_not_support' => 'Department sync for this third-party platform is not supported',
        'sync_failed' => 'Department sync failed',
    ],
    'login' => [
        'failed' => 'Login failed',
    ],
    'operation' => [
        'failed' => 'Operation failed',
    ],
    'file' => [
        'not_found' => 'File in message not found',
    ],
    'platform' => [
        'organization_code_not_found' => 'Platform organization code not found',
        'organization_env_not_found' => 'Platform organization environment not found',
    ],
    'magic' => [
        'environment_config_error' => 'Magic environment configuration error',
        'environment_not_found' => 'Magic environment not found',
        'ticket_not_found' => 'Magic appTicket not found',
    ],
    'authorization' => [
        'invalid' => 'authorization is invalid',
    ],
    'stream' => [
        'sequence_id_not_found' => 'Stream message sequence not found',
        'message_not_found' => 'Stream message not found',
        'receive_message_id_not_found' => 'Stream message receiver message ID not found',
    ],
];

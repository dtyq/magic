<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'common' => [
        'param_error' => ':param is invalid',
    ],
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
        'stream' => [
            'type_not_support' => 'Loại tin nhắn không được hỗ trợ cho tin nhắn trực tiếp',
        ],
    ],
];

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 任务逐轮终态不作为站内信提醒；协作邀请、分享和审核通知不受此开关影响。
    'task_enabled' => (bool) \Hyperf\Support\env('NOTIFICATION_TASK_ENABLED', false),
    'pagination' => [
        'default_page_size' => 10,
        'max_page_size' => 100,
    ],
    'locales' => [
        'default' => 'zh-CN',
        'supported' => ['zh-CN', 'en-US'],
    ],
    // Event consumption lease and recovery are notification-domain settings;
    // async-event retry settings remain owned by async-event.
    'processing_lease_seconds' => 300,
    'recovery_batch_size' => 100,
];

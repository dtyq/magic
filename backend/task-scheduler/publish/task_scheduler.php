<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 定时生成未来 n 天的数据
    'crontab_days' => 3,
    // 超过 n 天的数据会被清理
    'clear_days' => 10,

    // 开启环境隔离
    'environment_enabled' => false,

    // 同时执行的定时任务数量，协程数量控制
    'concurrency' => 500,

    // 锁超时时间
    'lock_timeout' => 600,
];

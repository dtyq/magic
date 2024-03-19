<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 定时生成未来 n 天的数据
    // 判断一下，如果是生产环境，则设置为3，如果是测试环境，则设置为365*2
    'crontab_days' => env('APP_ENV') == 'saas-test' ? 365 * 2 : 3,
    // 超过 n 天的数据会被清理
    'clear_days' => 10,

    // 关闭环境隔离
    'environment_enabled' => false,

    // 同时执行的定时任务数量，协程数量控制
    'concurrency' => 500,

    // 锁超时时间
    'lock_timeout' => 600,

    // 是否私有化部署
    'is_private_deploy' => (bool) env('IS_PRIVATE_DEPLOY', false),
];

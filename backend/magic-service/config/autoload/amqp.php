<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Amqp\IO\IOFactory;

use function Hyperf\Support\env;

// ！！！注意，开了定时任务的 pod 就不开 mq！避免定时任务阻塞 mq 消费!
$enableCrontab = (bool) env('CRONTAB_ENABLE', true);
return [
    // 架构分层,可能会把message和seq分别投递与消费,因此需要单独配置开关
    'enable_chat_message' => ! $enableCrontab,
    'enable_chat_seq' => ! $enableCrontab,
    // mq的总开关
    'enable' => ! $enableCrontab,
    'default' => [
        'host' => env('AMQP_HOST', 'localhost'),
        'port' => (int) env('AMQP_PORT', 5672),
        'user' => env('AMQP_USER', 'guest'),
        'password' => env('AMQP_PASSWORD', 'guest'),
        'vhost' => env('AMQP_VHOST', '/'),
        'open_ssl' => false,
        'concurrent' => [
            'limit' => 6,
        ],
        'pool' => [
            'connections' => 4,
        ],
        'io' => IOFactory::class,
        'params' => [
            'insist' => false,
            'login_method' => 'AMQPLAIN',
            'login_response' => null,
            'locale' => 'en_US',
            'connection_timeout' => 3,
            // Try to maintain twice value heartbeat as much as possible
            'read_write_timeout' => 6,
            'context' => null,
            'keepalive' => true,
            // Try to ensure that the consumption time of each message is less than the heartbeat time as much as possible
            'heartbeat' => 3,
            'channel_rpc_timeout' => 0.0,
            'close_on_destruct' => false,
            'max_idle_channels' => 10,
        ],
    ],
];

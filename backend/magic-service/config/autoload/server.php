<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\HttpServer\Server;
use Hyperf\Server\Event;
use Hyperf\Server\ServerInterface;
use Hyperf\Server\SwowServer;

use function Hyperf\Support\env;

$httpPort = (int) env('HTTP_PORT', 9501);
! defined('LOCAL_HTTP_URL') && define('LOCAL_HTTP_URL', 'http://127.0.1:' . $httpPort);

$servers = [
    [
        'name' => 'http',
        'type' => ServerInterface::SERVER_HTTP,
        'host' => '0.0.0.0',
        'port' => $httpPort,
        'callbacks' => [
            Event::ON_REQUEST => [Server::class, 'onRequest'],
        ],
    ],
    [
        'name' => 'socket-io',
        'type' => ServerInterface::SERVER_WEBSOCKET,
        'host' => '0.0.0.0',
        'port' => (int) env('WEBSOCKET_PORT', 9502),
        'sock_type' => 1,
        'callbacks' => [
            Event::ON_HAND_SHAKE => [Hyperf\WebSocketServer\Server::class, 'onHandShake'],
            Event::ON_MESSAGE => [Hyperf\WebSocketServer\Server::class, 'onMessage'],
            Event::ON_CLOSE => [Hyperf\WebSocketServer\Server::class, 'onClose'],
        ],
    ],
    // 出于单测的需要，mock 所有第三方的 http 调用，提升单测速度和稳定性。
    [
        'name' => 'mock-http-service',
        'type' => ServerInterface::SERVER_HTTP,
        'host' => '0.0.0.0',
        'port' => 9503,
        'callbacks' => [
            Event::ON_REQUEST => ['mock-http-service', 'onRequest'],
        ],
    ],
];
// ！！！注意，开了定时任务的 pod 就不启动 websocket 服务了，只启动 http 服务
$enableCrontab = (bool) env('CRONTAB_ENABLE', true);
$enableCrontab && $servers = [$servers[0]];
return [
    'type' => SwowServer::class,
    'servers' => $servers,
    'settings' => [
        'pid_file' => BASE_PATH . '/runtime/hyperf.pid',
    ],
];

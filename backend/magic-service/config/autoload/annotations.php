<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Aws\WrappedHttpHandler;
use GuzzleHttp\BodySummarizer;
use Hyperf\SocketIOServer\Command\RemoveRedisGarbage;
use Hyperf\SocketIOServer\Listener\ServerIdListener;
use Hyperf\SocketIOServer\Listener\StartSubscriberListener;
use Hyperf\SocketIOServer\Room\RedisAdapter;
use Hyperf\SocketIOServer\SidProvider\DistributedSidProvider;
use Hyperf\SocketIOServer\SocketIO;

return [
    'scan' => [
        'paths' => [
            BASE_PATH . '/app',
        ],
        'ignore_annotations' => [
            'mixin',
        ],
        'class_map' => [
            // 需要映射的类名 => 类所在的文件地址
            // 使用 class_map替换了三个类，自行实现了 hyperf/swow 下的chunk输出
            // Response::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/Response.php',
            // ResponseEmitter::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/ResponseEmitter.php',
            // ServerConnection::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/ServerConnection.php',
            // socket-io server 支持 swow 驱动
            SocketIO::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/SocketIO.php',
            ServerIdListener::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/ServerIdListener.php',
            StartSubscriberListener::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/StartSubscriberListener.php',
            RemoveRedisGarbage::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/RemoveRedisGarbage.php',
            // Socket.IO Redis v3：本地 fanout + 低 key 数路由索引；出问题可快速回滚到 RedisAdapter.php。
            RedisAdapter::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/RedisAdapterV3.php',
            DistributedSidProvider::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/DistributedSidProvider.php',
            // websocket server 支持 swow 驱动
            //            Sender::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/WebSocketServer/Sender.php',
            BodySummarizer::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/GuzzleHttp/BodySummarizer.php',
            // AWS SDK error handling enhancement
            WrappedHttpHandler::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/Aws/WrappedHttpHandler.php',
        ],
    ],
];

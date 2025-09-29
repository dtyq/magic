<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Aws\WrappedHttpHandler;
use GuzzleHttp\BodySummarizer;
use Hyperf\SocketIOServer\Room\RedisAdapter;
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
            RedisAdapter::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/SocketIoServer/RedisAdapter.php',
            // websocket server 支持 swow 驱动
            //            Sender::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/WebSocketServer/Sender.php',
            BodySummarizer::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/GuzzleHttp/BodySummarizer.php',
            // AWS SDK error handling enhancement
            WrappedHttpHandler::class => BASE_PATH . '/app/Infrastructure/Core/ClassMap/Aws/WrappedHttpHandler.php',
        ],
    ],
];

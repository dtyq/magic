<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Log\AppendRequestIdProcessor;
use App\Infrastructure\Util\Log\Formatter\NullFormatter;
use App\Infrastructure\Util\Log\Handler\StdoutHandler;
use Monolog\Level;

return [
    'default' => [
        'handler' => [
            'class' => StdoutHandler::class,
            'constructor' => [
                'level' => Level::Info,
            ],
        ],
        'formatter' => [
            'class' => NullFormatter::class,
        ],
        'processors' => [
            [
                'class' => AppendRequestIdProcessor::class,
            ],
        ],
    ],
    'debug' => [
        'handler' => [
            'class' => StdoutHandler::class,
            'constructor' => [
                'level' => Level::Debug,
            ],
        ],
        'formatter' => [
            'class' => NullFormatter::class,
        ],
        'processors' => [
            [
                'class' => AppendRequestIdProcessor::class,
            ],
        ],
    ],
];

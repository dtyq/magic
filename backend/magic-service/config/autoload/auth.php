<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Auth\Guard\WebsocketChatUserGuard;
use App\Infrastructure\Util\Auth\Guard\WebUserGuard;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Infrastructure\Utils\Auth\Guard\SandboxGuard;
use Dtyq\SuperMagic\Interfaces\Authorization\Web\SandboxAuthorization;
use Qbhy\HyperfAuth\Provider\EloquentProvider;

return [
    'default' => [
        'guard' => 'web',
        'provider' => 'magic-users',
    ],
    'guards' => [
        'web' => [
            'driver' => WebUserGuard::class,
            'provider' => 'magic-users',
        ],
        // 需要解析 websocket 上下文中的 token 信息，因此跟 WebUserGuard 不同
        'websocket' => [
            'driver' => WebsocketChatUserGuard::class,
            'provider' => 'magic-users',
        ],
        'sandbox' => [
            'driver' => SandboxGuard::class,
            'provider' => 'sandbox',
        ],
    ],
    'providers' => [
        // 麦吉自建用户体系
        'magic-users' => [
            'driver' => EloquentProvider::class,
            'model' => MagicUserAuthorization::class,
        ],
        'sandbox' => [
            'driver' => EloquentProvider::class,
            'model' => SandboxAuthorization::class,
        ],
    ],
];

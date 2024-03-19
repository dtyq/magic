<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Auth\Guard\PersonalAccessTokenGuard;
use App\Infrastructure\Util\Auth\Guard\WebUserGuard;
use App\Interfaces\Authorization\PersonalAccessToken\PersonalAccessTokenAuthorization;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
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
        // WebUserGuard 会自动检测 WebSocket 上下文，从 MagicContext 获取认证信息
        'websocket' => [
            'driver' => WebUserGuard::class,
            'provider' => 'magic-users',
        ],
        // 个人访问令牌鉴权
        'personal-token' => [
            'driver' => PersonalAccessTokenGuard::class,
            'provider' => 'personal-token-users',
        ],
    ],
    'providers' => [
        // 麦吉自建用户体系
        'magic-users' => [
            'driver' => EloquentProvider::class,
            'model' => MagicUserAuthorization::class,
        ],
        // 个人访问令牌用户体系
        'personal-token-users' => [
            'driver' => EloquentProvider::class,
            'model' => PersonalAccessTokenAuthorization::class,
        ],
    ],
];

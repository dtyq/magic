<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Auth\Guard\SandboxGuard;
use Dtyq\SuperMagic\Interfaces\Authorization\Web\SandboxAuthorization;
use Qbhy\HyperfAuth\Provider\EloquentProvider;

return [
    'guards' => [
        'sandbox' => [
            'driver' => SandboxGuard::class,
            'provider' => 'sandbox',
        ],
    ],
    'providers' => [
        'sandbox' => [
            'driver' => EloquentProvider::class,
            'model' => SandboxAuthorization::class,
        ],
    ],
];

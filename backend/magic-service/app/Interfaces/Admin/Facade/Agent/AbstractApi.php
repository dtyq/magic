<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Facade\Agent;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthGuard;
use Qbhy\HyperfAuth\AuthManager;

abstract class AbstractApi
{
    protected AuthGuard $adminGuard;

    public function __construct(
        private readonly AuthManager $authManager,
        protected readonly RequestInterface $request,
    ) {
        $this->adminGuard = $this->authManager->guard(name: 'web');
    }

    protected function getAuthorization(): Authenticatable|MagicUserAuthorization
    {
        return $this->adminGuard->user();
    }
}

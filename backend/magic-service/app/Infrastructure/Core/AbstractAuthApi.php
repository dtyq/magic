<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\HttpServer\Contract\RequestInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthGuard;
use Qbhy\HyperfAuth\AuthManager;

abstract class AbstractAuthApi
{
    private AuthGuard $authGuard;

    public function __construct(
        private readonly AuthManager $authManager,
        protected readonly RequestInterface $request,
    ) {
        $this->authGuard = $this->authManager->guard(name: $this->getGuardName());
    }

    abstract protected function getGuardName(): string;

    protected function createPage(?int $page = null, ?int $pageNum = null): Page
    {
        $params = $this->request->all();
        $page = $page ?? (int) ($params['page'] ?? 1);
        $pageNum = $pageNum ?? (int) ($params['page_size'] ?? 100);
        return new Page($page, $pageNum);
    }

    protected function getAuthorization(): Authenticatable
    {
        return $this->authGuard->user();
    }
}

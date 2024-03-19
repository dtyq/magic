<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        protected readonly RequestInterface $request,
    ) {
    }

    protected function createPage(?int $page = null, ?int $pageNum = null): Page
    {
        $params = $this->request->all();
        $page = $page ?? (int) ($params['page'] ?? 1);
        $pageNum = $pageNum ?? (int) ($params['page_size'] ?? 100);
        return new Page($page, $pageNum);
    }
}

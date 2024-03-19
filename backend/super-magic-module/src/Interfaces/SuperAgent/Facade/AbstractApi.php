<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        protected RequestInterface $request,
    ) {
    }

    protected function createPage(?int $page = null, ?int $pageNum = null): Page
    {
        $params = $this->request->all();
        $page = $page ?? (int) ($params['page'] ?? 1);
        $pageNum = $pageNum ?? (int) ($params['page_size'] ?? 100);
        return new Page($page, $pageNum);
    }

    /**
     * 从指定的请求头列表中按顺序获取令牌.
     */
    protected function getTokenFromHeaders(array $headerNames): string
    {
        foreach ($headerNames as $headerName) {
            if (! empty($this->request->getHeader($headerName))) {
                return $this->request->getHeader($headerName)[0];
            }
        }

        return '';
    }

    protected function getApiKey(): string
    {
        $headers = [
            'API-KEY',
            'api_key',
            'api-key',
            'API_KEY',
        ];

        $token = $this->getTokenFromHeaders($headers);
        if (! empty($token)) {
            return $token;
        }

        return '';
    }
}

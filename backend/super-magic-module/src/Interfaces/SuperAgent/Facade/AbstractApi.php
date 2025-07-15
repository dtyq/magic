<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractApi
{
    use MagicUserAuthorizationTrait;

    public function __construct(
        protected RequestInterface $request,
    ) {
    }

    protected function getAccessToken(): string
    {
        // 全面兼容 openai 的 api_key 格式

        // 1. 按顺序尝试从请求头中获取
        $headers = [
            'api-key',
            'llm-access-token',
        ];

        $token = $this->getTokenFromHeaders($headers);
        if (! empty($token)) {
            return $token;
        }

        // 2. 从 Authorization 头中获取 Bearer token
        $token = $this->getTokenFromBearerAuth();
        if (! empty($token)) {
            return $token;
        }

        // 3. 从 HTTP Basic Auth 中获取 token
        $token = $this->getTokenFromBasicAuth();
        if (! empty($token)) {
            return $token;
        }

        // 4. 从查询参数中获取
        $apiKey = $this->request->query('api_key');
        if (! empty($apiKey)) {
            return $apiKey;
        }

        // 5. 从请求体中获取
        $parsedBody = $this->request->getParsedBody();
        if (is_array($parsedBody) && isset($parsedBody['api_key'])) {
            return $parsedBody['api_key'];
        }

        return '';
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

    /**
     * 从 Authorization 头中获取 Bearer token.
     */
    protected function getTokenFromBearerAuth(): string
    {
        if (! empty($this->request->getHeader('authorization'))) {
            $authHeader = $this->request->getHeader('authorization')[0] ?? '';
            if (str_starts_with(strtolower($authHeader), 'bearer ')) {
                return substr($authHeader, 7);
            }
        }

        return '';
    }

    /**
     * 从 HTTP Basic Auth 中获取 token.
     */
    protected function getTokenFromBasicAuth(): string
    {
        if (! empty($this->request->getHeader('php-auth-user'))) {
            return $this->request->getHeader('php-auth-user')[0];
        }

        return '';
    }

    protected function getClientIps(): array
    {
        $serverParams = $this->request->getServerParams();

        $ips = [];
        $ipHeaders = ['x-forwarded-for', 'x-real-ip'];
        foreach ($ipHeaders as $header) {
            foreach ($this->request->getHeader($header) as $item) {
                $ips[] = trim($item);
            }
        }

        if (! empty($serverParams['remote_addr'])) {
            $ip = trim(explode(':', $serverParams['remote_addr'], 2)[0]);
            if (! empty($ip)) {
                $ips = array_merge($ips, [$ip]);
            }
        }

        return $ips;
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

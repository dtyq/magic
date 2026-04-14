<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;

abstract class AbstractOpenApi
{
    public function __construct(
        protected readonly RequestInterface $request,
    ) {
    }

    protected function getAccessToken(): string
    {
        // 0. 优先从协程上下文获取（中间件验证通过后设置的有效 token）
        // SandboxUserAuthMiddleware 或 ApiKeyMiddleware 验证成功后会设置此值
        if (RequestCoContext::hasApiKey()) {
            return RequestCoContext::getApiKey();
        }

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

    /**
     * 从协程上下文中提取业务参数，供 model-gateway DTO 统一复用。
     *
     * @return array<string, string>
     */
    protected function getBusinessParamsFromContext(): array
    {
        $businessParams = [];

        $magicUserAuthorization = RequestCoContext::getUserAuthorization();
        if (! $magicUserAuthorization instanceof MagicUserAuthorization) {
            return $businessParams;
        }

        $userId = $magicUserAuthorization->getId();
        $organizationCode = $magicUserAuthorization->getOrganizationCode();

        if ($userId !== '') {
            $businessParams['user_id'] = $userId;
        }

        if ($organizationCode !== '') {
            $businessParams['organization_id'] = $organizationCode;
            $businessParams['organization_code'] = $organizationCode;
        }

        return $businessParams;
    }

    /**
     * 为请求 DTO 注入请求头配置、业务参数和 access token，避免各个 Facade 重复拼装。
     */
    protected function enrichRequestDTO(AbstractRequestDTO $abstractRequestDTO, array $headers): void
    {
        $headerConfigs = RequestUtil::normalizeHeaders($headers);
        $abstractRequestDTO->setHeaderConfigs($headerConfigs);

        $this->addBusinessParamsFromHeaders($abstractRequestDTO, $headerConfigs);

        $contextParams = $this->getBusinessParamsFromContext();
        foreach ($contextParams as $key => $value) {
            $abstractRequestDTO->addBusinessParam($key, $value);
        }

        if (empty($abstractRequestDTO->getAccessToken()) && RequestCoContext::hasApiKey()) {
            $abstractRequestDTO->setAccessToken(RequestCoContext::getApiKey());
        }
    }

    /**
     * @param array<string, string> $headerConfigs
     */
    protected function addBusinessParamsFromHeaders(AbstractRequestDTO $abstractRequestDTO, array $headerConfigs): void
    {
        $mapping = [
            'business_id' => 'business_id',
            'magic-topic-id' => 'magic_topic_id',
            'magic-chat-topic-id' => 'magic_chat_topic_id',
            'magic-task-id' => 'magic_task_id',
            'magic-language' => 'language',
            'magic-organization-code' => 'organization_id',
            'magic-user-id' => 'user_id',
        ];

        foreach ($mapping as $headerKey => $paramKey) {
            $value = $headerConfigs[$headerKey] ?? '';
            if ($value !== '') {
                $abstractRequestDTO->addBusinessParam($paramKey, $value);
            }
        }
    }

    /**
     * 从请求头和协程上下文组合业务参数，适用于非 DTO 接口.
     *
     * @return array<string, string>
     */
    protected function getBusinessParams(): array
    {
        $businessParams = $this->getBusinessParamsFromContext();
        $headers = RequestUtil::normalizeHeaders($this->request->getHeaders());

        $mapping = [
            'magic-organization-code' => 'organization_id',
            'magic-organization-id' => 'organization_id',
            'magic-user-id' => 'user_id',
        ];
        foreach ($mapping as $headerKey => $paramKey) {
            $value = $headers[$headerKey] ?? '';
            if ($value !== '') {
                $businessParams[$paramKey] = $value;
            }
        }

        if (isset($businessParams['organization_id']) && ! isset($businessParams['organization_code'])) {
            $businessParams['organization_code'] = $businessParams['organization_id'];
        }

        return $businessParams;
    }
}

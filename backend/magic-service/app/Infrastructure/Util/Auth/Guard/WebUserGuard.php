<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Guard;

use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Codec\Json;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\Guard\AbstractAuthGuard;
use Throwable;

class WebUserGuard extends AbstractAuthGuard
{
    private ?LoggerInterface $logger = null;

    private ?Redis $redis = null;

    public function login(Authenticatable $user): void
    {
    }

    /**
     * @throws Throwable
     */
    public function user(): MagicUserAuthorization
    {
        [$authorization, $organizationCode] = $this->getCredentials();

        if (empty($authorization)) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }
        // organizationCode 可以为空，因为 auth 可能是个人级别的
        $apiKey = $this->getApiKeyFromRequest();
        // 使用 Redis 缓存，缓存 key 包含 api-key 以区分不同的 API-Key 场景。
        // 加上 MagicUserAuthorization::class 是为了在类的命名空间变更时自动使旧缓存失效
        $cacheKey = 'auth_user:' . md5($authorization . $organizationCode . $apiKey . MagicUserAuthorization::class);
        $cachedResult = $this->getRedis()->get($cacheKey);
        if ($cachedResult) {
            $user = unserialize($cachedResult, ['allowed_classes' => [MagicUserAuthorization::class]]);
            if ($user instanceof MagicUserAuthorization) {
                return $user;
            }
        }

        try {
            /** @var null|MagicUserAuthorization $user */
            $user = $this->userProvider->retrieveByCredentials([
                'authorization' => $authorization,
                'organizationCode' => $organizationCode,
            ]);
            if ($user === null) {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            }
            if (empty($user->getOrganizationCode())) {
                ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
            }

            $this->getRedis()->setex($cacheKey, 60, serialize($user));
            $this->getLogger()->info('WebUserGuard UserAuthorization', [
                'uid' => $user->getId(),
                'organization' => $user->getOrganizationCode(),
                'env' => $user->getMagicEnvId(),
                'has_api_key' => $apiKey !== '',
            ]);

            return $user;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            $this->getLogger()->error('WebUserGuard ' . Json::encode($errMsg));
            throw $exception;
        }
    }

    public function logout(): void
    {
    }

    /**
     * 从请求头获取 API-Key.
     */
    private function getApiKeyFromRequest(): string
    {
        try {
            $request = di(RequestInterface::class);
            return RequestUtil::getApiKeyHeader($request->getHeaders());
        } catch (Throwable) {
            return '';
        }
    }

    /**
     * 获取认证凭证（authorization 和 organizationCode）.
     * 优先从 WebSocket 上下文获取，否则从 HTTP 请求头获取.
     * @return array{0: string, 1: string} [authorization, organizationCode]
     */
    private function getCredentials(): array
    {
        // 尝试从 WebSocket 上下文获取
        try {
            $magicContext = WebSocketContext::get(MagicContext::class);
            if ($magicContext instanceof MagicContext) {
                return [
                    $magicContext->getAuthorization(),
                    $magicContext->getOrganizationCode(),
                ];
            }
        } catch (Throwable) {
            // 不在 WebSocket 上下文中，忽略异常
        }

        // 从 HTTP 请求头获取
        try {
            $request = di(RequestInterface::class);
            return [
                $this->getAuthorizationHeader($request->getHeaders()),
                $request->header('organization-code', ''),
            ];
        } catch (Throwable) {
            return ['', ''];
        }
    }

    /**
     * 获取 authorization header 值，支持多种变体.
     * 支持 authorization 和 user-authorization，兼容大小写和下划线.
     * 优先级：user-authorization > authorization.
     */
    private function getAuthorizationHeader(array $allHeaders): string
    {
        // 按优先级顺序定义目标 headers：user-authorization 优先
        $targetHeaders = ['user-authorization', 'authorization'];

        // 先收集所有匹配的 header 值
        $foundHeaders = [];
        foreach ($allHeaders as $headerName => $headerValues) {
            // 转换为小写并将下划线转换为中划线
            $normalizedName = str_replace('_', '-', strtolower((string) $headerName));
            if (! empty($headerValues[0]) && in_array($normalizedName, $targetHeaders, true)) {
                $foundHeaders[$normalizedName] = $headerValues[0];
            }
        }

        // 按优先级返回
        foreach ($targetHeaders as $targetHeader) {
            if (isset($foundHeaders[$targetHeader])) {
                return $foundHeaders[$targetHeader];
            }
        }

        return '';
    }

    private function getLogger(): LoggerInterface
    {
        if ($this->logger === null) {
            $this->logger = di(LoggerFactory::class)->get(static::class);
        }
        return $this->logger;
    }

    private function getRedis(): Redis
    {
        if ($this->redis === null) {
            $this->redis = di(Redis::class);
        }
        return $this->redis;
    }
}

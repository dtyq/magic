<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Guard;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\PersonalAccessToken\PersonalAccessTokenAuthorization;
use Hyperf\Codec\Json;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\Guard\AbstractAuthGuard;
use Throwable;

class PersonalAccessTokenGuard extends AbstractAuthGuard
{
    private ?LoggerInterface $logger = null;

    private ?Redis $redis = null;

    public function login(Authenticatable $user): void
    {
        // Personal Access Token 不需要登录逻辑
    }

    /**
     * @throws Throwable
     */
    public function user(): ?Authenticatable
    {
        $token = $this->getTokenFromRequest();

        if (empty($token)) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }

        // 使用 Redis 缓存，避免频繁查库
        $cacheKey = 'personal_token_auth:' . md5($token . PersonalAccessTokenAuthorization::class);
        $cachedResult = $this->getRedis()->get($cacheKey);
        if ($cachedResult) {
            $user = unserialize($cachedResult, ['allowed_classes' => [PersonalAccessTokenAuthorization::class]]);
            if ($user instanceof PersonalAccessTokenAuthorization) {
                return $user;
            }
        }

        try {
            /** @var null|PersonalAccessTokenAuthorization $user */
            $user = $this->userProvider->retrieveByCredentials([
                'token' => $token,
            ]);

            if ($user === null) {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            }

            if (empty($user->getOrganizationCode())) {
                ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
            }

            $this->getRedis()->setex($cacheKey, 60, serialize($user));
            $this->getLogger()->info('PersonalAccessTokenGuard Authorization Success', [
                'uid' => $user->getId(),
                'name' => $user->getNickname(),
                'organization' => $user->getOrganizationCode(),
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
            $this->getLogger()->error('PersonalAccessTokenGuard ' . Json::encode($errMsg));
            throw $exception;
        }
    }

    public function logout(): void
    {
        // Personal Access Token 不需要登出逻辑
    }

    /**
     * 从请求头获取token.
     * 支持两种方式：
     * 1. Personal-Access-Token: {token}
     * 2. Authorization: Bearer {token}.
     */
    private function getTokenFromRequest(): string
    {
        try {
            $request = di(RequestInterface::class);
            $headers = $request->getHeaders();

            // 优先从 Personal-Access-Token 获取
            foreach ($headers as $headerName => $headerValues) {
                $normalizedName = str_replace('_', '-', strtolower((string) $headerName));
                if ($normalizedName === 'personal-access-token' && ! empty($headerValues[0])) {
                    return $headerValues[0];
                }
            }

            // 从 Authorization 获取
            $authorization = $request->header('authorization', '');
            if (! empty($authorization)) {
                // 去除 Bearer 前缀
                if (stripos($authorization, 'Bearer ') === 0) {
                    return substr($authorization, 7);
                }
                return $authorization;
            }

            return '';
        } catch (Throwable) {
            return '';
        }
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

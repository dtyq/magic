<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Guard;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Codec\Json;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\Guard\AbstractAuthGuard;
use Throwable;

class WebUserGuard extends AbstractAuthGuard
{
    #[Inject]
    protected LoggerInterface $logger;

    #[Inject]
    protected Redis $redis;

    public function login(Authenticatable $user): void
    {
    }

    /**
     * @return MagicUserAuthorization
     * @throws Throwable
     */
    public function user(): ?Authenticatable
    {
        $request = di(RequestInterface::class);
        $logger = di(LoggerInterface::class);
        $authorization = $request->header('authorization', '');
        $organizationCode = $request->header('organization-code', '');

        if (empty($authorization)) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }
        if (empty($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }
        $cacheKey = 'auth_user:' . md5($authorization . $organizationCode);
        $cachedResult = $this->redis->get($cacheKey);
        if ($cachedResult) {
            $user = unserialize($cachedResult, ['allowed_classes' => [MagicUserAuthorization::class]]);
            if ($user instanceof MagicUserAuthorization) {
                return $user;
            }
        }

        try {
            // 下面这段实际调用的是 MagicUserAuthorization 的 retrieveById 方法
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
            if ($user instanceof MagicUserAuthorization) {
                $this->redis->setex($cacheKey, 60, serialize($user));
            }
            $logger->info('WebUserGuard UserAuthorization', ['uid' => $user->getId(), 'name' => $user->getRealName(), 'organization' => $user->getOrganizationCode(), 'env' => $user->getMagicEnvId()]);
            return $user;
        } catch (Throwable $exception) {
            $errMsg = [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ];
            $logger->error('InternalUserGuard ' . Json::encode($errMsg));
            throw $exception;
        }
    }

    public function logout(): void
    {
    }

    protected function resultKey($token): string
    {
        return md5($this->name . '.auth.result.' . $token);
    }
}

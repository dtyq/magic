<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils\Auth\Guard;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Interfaces\Authorization\Web\SandboxAuthorization;
use Hyperf\Codec\Json;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\Guard\AbstractAuthGuard;
use Throwable;

class SandboxGuard extends AbstractAuthGuard
{
    #[Inject]
    protected LoggerInterface $logger;

    #[Inject]
    protected Redis $redis;

    public function login(Authenticatable $user)
    {
    }

    public function user(): ?Authenticatable
    {
        $request = di(RequestInterface::class);
        $logger = di(LoggerInterface::class);

        $token = $request->header('token', '');
        $userId = $request->header('user-id', '');

        if (empty($token) || empty($userId)) {
            ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND);
        }
        $cacheKey = 'auth_user:' . md5($token . $userId);
        $cachedResult = $this->redis->get($cacheKey);
        if ($cachedResult) {
            $user = unserialize($cachedResult, ['allowed_classes' => [MagicUserAuthorization::class]]);
            if ($user instanceof MagicUserAuthorization) {
                return $user;
            }
        }

        try {
            /** @var null|SandboxAuthorization $user */
            $user = $this->userProvider->retrieveByCredentials([
                'token' => $token,
                'userId' => $userId,
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
            $logger->info('SandboxGuard UserAuthorization', ['uid' => $user->getId(), 'name' => $user->getRealName(), 'organization' => $user->getOrganizationCode()]);
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

    public function logout()
    {
    }
}

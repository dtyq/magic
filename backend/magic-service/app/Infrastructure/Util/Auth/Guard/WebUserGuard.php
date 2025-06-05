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
use Hyperf\Context\Context;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\Guard\AbstractAuthGuard;
use Throwable;

class WebUserGuard extends AbstractAuthGuard
{
    #[Inject]
    protected LoggerInterface $logger;

    public function login(Authenticatable $user)
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
        $contextKey = md5("{$authorization}@{$organizationCode}");

        if ($result = Context::get($contextKey)) {
            if ($result instanceof Throwable) {
                throw $result;
            }
            if ($result instanceof Authenticatable) {
                /* @phpstan-ignore-next-line */
                return $result;
            }
            return null;
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

            Context::set($contextKey, $user);
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

    public function logout()
    {
    }

    protected function resultKey($token): string
    {
        return md5($this->name . '.auth.result.' . $token);
    }
}

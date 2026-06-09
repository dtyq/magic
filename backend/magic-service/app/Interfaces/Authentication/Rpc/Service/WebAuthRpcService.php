<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Rpc\Service;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_AUTH_WEB_AUTH)]
readonly class WebAuthRpcService
{
    private const array UNAUTHORIZED_CODES = [
        401,
        403,
        UserErrorCode::USER_NOT_EXIST->value,
        UserErrorCode::ORGANIZATION_NOT_EXIST->value,
    ];

    public function __construct(
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_AUTHENTICATE)]
    public function authenticate(array $params): array
    {
        $authorization = trim((string) ($params['authorization'] ?? ''));
        $organizationCode = trim((string) ($params['organization_code'] ?? $params['organizationCode'] ?? ''));

        if ($authorization === '' || $organizationCode === '') {
            return [
                'code' => 401,
                'message' => 'authorization or organization_code is empty',
            ];
        }

        try {
            $user = MagicUserAuthorization::retrieveById([
                'authorization' => $authorization,
                'organizationCode' => $organizationCode,
            ]);
            if (! $user instanceof MagicUserAuthorization) {
                return [
                    'code' => 401,
                    'message' => 'unauthorized',
                ];
            }

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'user_id' => $user->getId(),
                    'magic_id' => $user->getMagicId(),
                    'organization_code' => $user->getOrganizationCode(),
                    'magic_env_id' => $user->getMagicEnvId(),
                ],
            ];
        } catch (Throwable $exception) {
            $this->logger->warning('IPC Web auth failed', [
                'organization_code' => $organizationCode,
                'error' => $exception->getMessage(),
                'code' => $exception->getCode(),
            ]);

            $code = (int) $exception->getCode();
            return [
                'code' => in_array($code, self::UNAUTHORIZED_CODES, true) ? $code : 500,
                'message' => 'web auth failed',
            ];
        }
    }
}

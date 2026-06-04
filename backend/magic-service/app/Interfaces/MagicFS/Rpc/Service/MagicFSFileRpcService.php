<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MagicFS\Rpc\Service;

use App\Application\Authentication\Service\AuthSandboxAppService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\MagicFS\Service\MagicFSFileAppService;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_MAGICFS_FILE)]
readonly class MagicFSFileRpcService
{
    private const string FILE_ACCESS_CACHE_PREFIX = 'magicfs:file_access:v1:';

    private const int FILE_ACCESS_CACHE_TTL = 10;

    private const string VIEWER_ROLE = 'viewer';

    public function __construct(
        private AuthSandboxAppService $authSandboxAppService,
        private MagicFSFileAppService $magicFSFileAppService,
        private MagicFSFileAccessCache $accessCache,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_AUTHORIZE_FILE_VIEWER)]
    public function authorizeFileViewer(array $params): array
    {
        $fileId = trim((string) ($params['file_id'] ?? ''));
        $headers = (array) ($params['headers'] ?? []);

        try {
            $authorization = $this->authSandboxAppService->authenticate($headers);
            if (! $authorization instanceof MagicUserAuthorization) {
                ExceptionBuilder::throw(UserErrorCode::ACCOUNT_ERROR);
            }
            if ($fileId === '') {
                ExceptionBuilder::throw(MagicFSErrorCode::FILE_NOT_FOUND);
            }

            $cacheKey = $this->buildFileAccessCacheKey($authorization, $fileId, self::VIEWER_ROLE);
            if ($this->isAccessCached($cacheKey)) {
                return $this->success($fileId);
            }

            $this->magicFSFileAppService->getFileInfo($authorization, $fileId);
            $this->cacheAccess($cacheKey);

            return $this->success($fileId);
        } catch (BusinessException $exception) {
            return [
                'code' => $exception->getCode(),
                'message' => $exception->getMessage(),
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC MagicFS file viewer authorization failed', [
                'file_id' => $fileId,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => GenericErrorCode::SystemError->value,
                'message' => 'system_exception',
            ];
        }
    }

    private function success(string $fileId): array
    {
        return [
            'code' => 0,
            'message' => 'success',
            'data' => [
                'file_id' => $fileId,
            ],
        ];
    }

    private function buildFileAccessCacheKey(MagicUserAuthorization $authorization, string $fileId, string $role): string
    {
        $scope = implode('|', [
            $authorization->getOrganizationCode(),
            $authorization->getId(),
            $fileId,
            $role,
        ]);

        return self::FILE_ACCESS_CACHE_PREFIX . sha1($scope);
    }

    private function isAccessCached(string $cacheKey): bool
    {
        try {
            return $this->accessCache->has($cacheKey);
        } catch (Throwable $throwable) {
            $this->logger->warning('Read MagicFS file access cache failed', [
                'cache_key' => $cacheKey,
                'error' => $throwable->getMessage(),
            ]);
            return false;
        }
    }

    private function cacheAccess(string $cacheKey): void
    {
        try {
            $this->accessCache->put($cacheKey, self::FILE_ACCESS_CACHE_TTL);
        } catch (Throwable $throwable) {
            $this->logger->warning('Write MagicFS file access cache failed', [
                'cache_key' => $cacheKey,
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Rpc\Service;

use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_PERMISSION_OPERATION_PERMISSION)]
readonly class OperationPermissionRpcService
{
    public function __construct(
        private OperationPermissionDomainService $operationPermissionDomainService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_ACCESS_OWNER)]
    public function accessOwner(array $params): array
    {
        [$organizationCode, $currentUserId, $resourceType, $resourceId] = $this->normalizeResourceParams($params);
        $ownerUserId = trim((string) ($params['owner_user_id'] ?? ''));
        if ($organizationCode === '' || $currentUserId === '' || $resourceId === '' || $ownerUserId === '' || $resourceType === null) {
            return [
                'code' => 400,
                'message' => 'invalid access owner params',
            ];
        }

        try {
            $this->operationPermissionDomainService->accessOwner(
                PermissionDataIsolation::create($organizationCode, $currentUserId),
                $resourceType,
                $resourceId,
                $ownerUserId
            );

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC permission accessOwner failed', [
                'organization_code' => $organizationCode,
                'current_user_id' => $currentUserId,
                'resource_type' => $resourceType->value,
                'resource_id' => $resourceId,
                'owner_user_id' => $ownerUserId,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_DELETE_BY_RESOURCE)]
    public function deleteByResource(array $params): array
    {
        [$organizationCode, $currentUserId, $resourceType, $resourceId] = $this->normalizeResourceParams($params);
        if ($organizationCode === '' || $resourceId === '' || $resourceType === null) {
            return [
                'code' => 400,
                'message' => 'invalid delete resource params',
            ];
        }

        try {
            $this->operationPermissionDomainService->deleteByResource(
                PermissionDataIsolation::create($organizationCode, $currentUserId),
                $resourceType,
                $resourceId
            );

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC permission deleteByResource failed', [
                'organization_code' => $organizationCode,
                'current_user_id' => $currentUserId,
                'resource_type' => $resourceType->value,
                'resource_id' => $resourceId,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    /**
     * @return array{string, string, ?ResourceType, string}
     */
    private function normalizeResourceParams(array $params): array
    {
        $organizationCode = trim((string) ($params['organization_code'] ?? ''));
        $currentUserId = trim((string) ($params['current_user_id'] ?? ''));
        $resourceId = trim((string) ($params['resource_id'] ?? ''));
        $resourceType = ResourceType::tryFrom((int) ($params['resource_type'] ?? 0));

        return [$organizationCode, $currentUserId, $resourceType, $resourceId];
    }
}

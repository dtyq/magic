<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\Rpc\Service;

use App\Application\KnowledgeBase\Service\KnowledgeBaseOperationPermissionAppService;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Psr\Log\LoggerInterface;
use Throwable;

#[RpcService(name: SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE_PERMISSION)]
readonly class KnowledgeBasePermissionRpcService
{
    public function __construct(
        private KnowledgeBaseOperationPermissionAppService $knowledgeBaseOperationPermissionAppService,
        private LoggerInterface $logger,
    ) {
    }

    #[RpcMethod(name: SvcMethods::METHOD_LIST_OPERATIONS)]
    public function listOperations(array $params): array
    {
        $dataIsolation = $params['data_isolation'] ?? [];
        $organizationCode = trim((string) ($dataIsolation['organization_code'] ?? ''));
        $userId = trim((string) ($dataIsolation['user_id'] ?? ''));
        $knowledgeCodes = array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            (array) ($params['knowledge_codes'] ?? [])
        ), static fn (string $value): bool => $value !== ''));

        if ($organizationCode === '' || $userId === '') {
            return [
                'code' => 400,
                'message' => 'organization_code and user_id are required',
            ];
        }

        try {
            $baseDataIsolation = KnowledgeBaseDataIsolation::create($organizationCode, $userId);
            $permissionDataIsolation = KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($baseDataIsolation);
            $operations = $this->knowledgeBaseOperationPermissionAppService->getKnowledgeOperationByUserIds(
                $permissionDataIsolation,
                [$userId],
                $knowledgeCodes,
            )[$userId] ?? [];

            return [
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'operations' => $this->formatOperations($operations),
                ],
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC KnowledgeBasePermission listOperations failed', [
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'knowledge_codes' => $knowledgeCodes,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    #[RpcMethod(name: SvcMethods::METHOD_INITIALIZE)]
    public function initialize(array $params): array
    {
        return $this->mutateKnowledgePermission($params, 'initialize');
    }

    #[RpcMethod(name: SvcMethods::METHOD_GRANT_OWNER)]
    public function grantOwner(array $params): array
    {
        return $this->mutateKnowledgePermission($params, 'grant_owner');
    }

    #[RpcMethod(name: SvcMethods::METHOD_CLEANUP)]
    public function cleanup(array $params): array
    {
        return $this->mutateKnowledgePermission($params, 'cleanup');
    }

    #[RpcMethod(name: SvcMethods::METHOD_CHECK_OFFICIAL_ORGANIZATION_MEMBER)]
    public function checkOfficialOrganizationMember(array $params): array
    {
        $dataIsolation = $params['data_isolation'] ?? [];
        $organizationCode = trim((string) ($dataIsolation['organization_code'] ?? ''));

        if ($organizationCode === '') {
            return [
                'code' => 400,
                'message' => 'organization_code is required',
            ];
        }

        return [
            'code' => 0,
            'message' => 'success',
            'data' => [
                'is_official_member' => OfficialOrganizationUtil::isOfficialOrganization($organizationCode),
            ],
        ];
    }

    private function mutateKnowledgePermission(array $params, string $action): array
    {
        $dataIsolation = $params['data_isolation'] ?? [];
        $organizationCode = trim((string) ($dataIsolation['organization_code'] ?? ''));
        $userId = trim((string) ($dataIsolation['user_id'] ?? ''));
        $knowledgeCode = trim((string) ($params['knowledge_base_code'] ?? ''));
        $ownerUserId = trim((string) ($params['owner_user_id'] ?? ''));
        $adminUserIds = array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            (array) ($params['admin_user_ids'] ?? [])
        ), static fn (string $value): bool => $value !== ''));

        if ($organizationCode === '' || $userId === '' || $knowledgeCode === '') {
            return [
                'code' => 400,
                'message' => 'organization_code, user_id and knowledge_base_code are required',
            ];
        }
        if (($action === 'initialize' || $action === 'grant_owner') && $ownerUserId === '') {
            return [
                'code' => 400,
                'message' => 'owner_user_id is required',
            ];
        }

        try {
            $baseDataIsolation = KnowledgeBaseDataIsolation::create($organizationCode, $userId);
            $permissionDataIsolation = KnowledgeBasePermissionDataIsolation::createByBaseDataIsolation($baseDataIsolation);

            match ($action) {
                'initialize' => $this->knowledgeBaseOperationPermissionAppService->initializeKnowledgePermission(
                    $permissionDataIsolation,
                    $knowledgeCode,
                    $ownerUserId,
                    $adminUserIds,
                ),
                'grant_owner' => $this->knowledgeBaseOperationPermissionAppService->grantKnowledgeOwner(
                    $permissionDataIsolation,
                    $knowledgeCode,
                    $ownerUserId,
                ),
                'cleanup' => $this->knowledgeBaseOperationPermissionAppService->cleanupKnowledgePermission(
                    $permissionDataIsolation,
                    $knowledgeCode,
                ),
                default => null,
            };

            return [
                'code' => 0,
                'message' => 'success',
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('IPC KnowledgeBasePermission mutate failed', [
                'action' => $action,
                'organization_code' => $organizationCode,
                'user_id' => $userId,
                'knowledge_base_code' => $knowledgeCode,
                'error' => $throwable->getMessage(),
            ]);

            return [
                'code' => 500,
                'message' => $throwable->getMessage(),
            ];
        }
    }

    /**
     * @param array<string, Operation> $operations
     * @return array<string, string>
     */
    private function formatOperations(array $operations): array
    {
        $result = [];
        foreach ($operations as $knowledgeCode => $operation) {
            if (! $operation instanceof Operation) {
                continue;
            }
            $result[$knowledgeCode] = match ($operation) {
                Operation::Owner => 'owner',
                Operation::Admin => 'admin',
                Operation::Edit => 'edit',
                Operation::Read => 'read',
                default => 'none',
            };
        }

        return $result;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use JetBrains\PhpStorm\ArrayShape;

readonly class KnowledgeBaseOperationPermissionAppService
{
    public function __construct(
        private OperationPermissionRepositoryInterface $operationPermissionRepository,
        private MagicDepartmentUserRepositoryInterface $departmentUserRepository,
        private OperationPermissionDomainService $operationPermissionDomainService,
    ) {
    }

    /**
     * @return array<string, array<string, Operation>>
     */
    #[ArrayShape([
        'string' => [
            'string' => Operation::class,
        ],
    ])]
    public function getKnowledgeOperationByUserIds(
        KnowledgeBasePermissionDataIsolation $dataIsolation,
        array $userIds,
        array $knowledgeCodes = []
    ): array {
        if ($userIds === []) {
            return [];
        }

        $contactDataIsolation = ContactDataIsolation::simpleMake($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
        $userDepartmentIds = $this->departmentUserRepository->getDepartmentIdsByUserIds($contactDataIsolation, $userIds, true);

        $targetIds = $userIds;
        $departmentUserIds = [];
        foreach ($userDepartmentIds as $userId => $departmentIds) {
            foreach ($departmentIds as $departmentId) {
                $targetIds[] = $departmentId;
                $departmentUserIds[$departmentId][] = $userId;
            }
        }
        $targetIds = array_values(array_unique($targetIds));

        $operationPermissions = $this->operationPermissionRepository->listByTargetIds(
            $dataIsolation,
            ResourceType::Knowledge,
            $targetIds,
            $knowledgeCodes
        );

        $operations = [];
        foreach ($operationPermissions as $operationPermission) {
            if ($operationPermission->getTargetType() === TargetType::UserId) {
                $userId = $operationPermission->getTargetId();
                $topOperation = $operations[$userId][$operationPermission->getResourceId()] ?? null;
                if ($operationPermission->getOperation()->gt($topOperation)) {
                    $operations[$userId][$operationPermission->getResourceId()] = $operationPermission->getOperation();
                }
                continue;
            }

            if ($operationPermission->getTargetType() !== TargetType::DepartmentId) {
                continue;
            }

            foreach ($departmentUserIds[$operationPermission->getTargetId()] ?? [] as $userId) {
                $topOperation = $operations[$userId][$operationPermission->getResourceId()] ?? null;
                if ($operationPermission->getOperation()->gt($topOperation)) {
                    $operations[$userId][$operationPermission->getResourceId()] = $operationPermission->getOperation();
                }
            }
        }

        return $operations;
    }

    /**
     * 初始化知识库 owner/admin 权限.
     * @param array<string> $adminUserIds
     */
    public function initializeKnowledgePermission(
        KnowledgeBasePermissionDataIsolation $dataIsolation,
        string $knowledgeCode,
        string $ownerUserId,
        array $adminUserIds = []
    ): void {
        $knowledgeCode = trim($knowledgeCode);
        $ownerUserId = trim($ownerUserId);
        if ($knowledgeCode === '' || $ownerUserId === '') {
            return;
        }

        $this->operationPermissionDomainService->accessOwner(
            $dataIsolation,
            ResourceType::Knowledge,
            $knowledgeCode,
            $ownerUserId
        );

        $adminUserIds = array_values(array_unique(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $adminUserIds
        ), static fn (string $value): bool => $value !== '' && $value !== $ownerUserId)));
        if ($adminUserIds === []) {
            return;
        }

        $permissions = [];
        foreach ($adminUserIds as $adminUserId) {
            $permission = new OperationPermissionEntity();
            $permission->setTargetType(TargetType::UserId);
            $permission->setTargetId($adminUserId);
            $permission->setOperation(Operation::Admin);
            $permissions[] = $permission;
        }
        $this->operationPermissionDomainService->resourceAccess(
            $dataIsolation,
            ResourceType::Knowledge,
            $knowledgeCode,
            $permissions
        );
    }

    public function grantKnowledgeOwner(
        KnowledgeBasePermissionDataIsolation $dataIsolation,
        string $knowledgeCode,
        string $ownerUserId
    ): void {
        $knowledgeCode = trim($knowledgeCode);
        $ownerUserId = trim($ownerUserId);
        if ($knowledgeCode === '' || $ownerUserId === '') {
            return;
        }

        $this->operationPermissionDomainService->accessOwner(
            $dataIsolation,
            ResourceType::Knowledge,
            $knowledgeCode,
            $ownerUserId
        );
    }

    public function cleanupKnowledgePermission(
        KnowledgeBasePermissionDataIsolation $dataIsolation,
        string $knowledgeCode
    ): void {
        $knowledgeCode = trim($knowledgeCode);
        if ($knowledgeCode === '') {
            return;
        }

        $this->operationPermissionDomainService->deleteByResource(
            $dataIsolation,
            ResourceType::Knowledge,
            $knowledgeCode
        );
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBasePermissionDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Domain\Permission\Repository\Facade\OperationPermissionRepositoryInterface;
use JetBrains\PhpStorm\ArrayShape;

readonly class KnowledgeBaseOperationPermissionAppService
{
    public function __construct(
        private OperationPermissionRepositoryInterface $operationPermissionRepository,
        private MagicDepartmentUserRepositoryInterface $departmentUserRepository,
    ) {
    }

    public function getKnowledgeOperationByUser(
        KnowledgeBasePermissionDataIsolation $dataIsolation,
        string $knowledgeCode,
        string $userId
    ): Operation {
        return $this->getKnowledgeOperationByUserIds($dataIsolation, [$userId], [$knowledgeCode])[$userId][$knowledgeCode] ?? Operation::None;
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
}

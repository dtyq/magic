<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Assembler;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Permission\Entity\OperationPermissionEntity;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\TargetType;
use App\Interfaces\Permission\DTO\ResourceAccessDTO;
use App\Interfaces\Permission\DTO\TargetInfoDTO;
use App\Interfaces\Permission\DTO\TargetOperationDTO;
use DateTime;

class OperationPermissionAssembler
{
    public static function createResourceAccessDO(ResourceAccessDTO $resourceAccessDTO): array
    {
        $operationPermissions = [];
        foreach ($resourceAccessDTO->getTargets() as $targetOperationDTO) {
            $targetType = TargetType::make($targetOperationDTO->getTargetType());
            $operationPermissionEntity = new OperationPermissionEntity();
            $operationPermissionEntity->setTargetType($targetType);
            $operationPermissionEntity->setTargetId($targetOperationDTO->getTargetId());
            $operationPermissionEntity->setOperation(Operation::make($targetOperationDTO->getOperation()));
            $operationPermissionEntity->setCreatedAt(new DateTime());
            $operationPermissions[] = $operationPermissionEntity;
        }
        return $operationPermissions;
    }

    /**
     * @param array<OperationPermissionEntity> $operationPermissions
     * @param array<string, MagicUserEntity> $users
     * @param array<string, MagicDepartmentEntity> $departments
     * @param array<string, MagicGroupEntity> $groups
     */
    public static function createResourceAccessDTO(ResourceType $resourceType, string $resourceId, array $operationPermissions, array $users = [], array $departments = [], array $groups = []): ResourceAccessDTO
    {
        $resourceAccessDTO = new ResourceAccessDTO();
        $resourceAccessDTO->setResourceType($resourceType->value);
        $resourceAccessDTO->setResourceId($resourceId);
        $targets = [];
        foreach ($operationPermissions as $operationPermission) {
            $targetOperationDTO = new TargetOperationDTO();
            $targetOperationDTO->setTargetType($operationPermission->getTargetType()->value);
            $targetOperationDTO->setTargetId($operationPermission->getTargetId());
            $targetOperationDTO->setOperation($operationPermission->getOperation()->value);
            $targetInfo = match ($operationPermission->getTargetType()) {
                TargetType::UserId => TargetInfoDTO::makeByUser($users[$operationPermission->getTargetId()] ?? null),
                TargetType::DepartmentId => TargetInfoDTO::makeByDepartment($departments[$operationPermission->getTargetId()] ?? null),
                TargetType::GroupId => TargetInfoDTO::makeByGroup($groups[$operationPermission->getTargetId()] ?? null),
                default => null,
            };
            $targetOperationDTO->setTargetInfo($targetInfo);

            if ($operationPermission->getOperation()->isOwner()) {
                // 放到最前面
                array_unshift($targets, $targetOperationDTO);
            } else {
                $targets[] = $targetOperationDTO;
            }
        }
        $resourceAccessDTO->setTargets($targets);
        return $resourceAccessDTO;
    }

    public static function createTargetInfoDTOByMixed(mixed $data): ?TargetInfoDTO
    {
        if ($data instanceof TargetInfoDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new TargetInfoDTO($data);
        }
        return null;
    }
}

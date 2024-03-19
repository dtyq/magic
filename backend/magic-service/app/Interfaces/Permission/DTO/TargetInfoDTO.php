<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Infrastructure\Core\AbstractDTO;

class TargetInfoDTO extends AbstractDTO
{
    public string $id;

    public string $name = '';

    public string $icon = '';

    public string $description = '';

    public static function makeByUser(mixed $userEntity): ?TargetInfoDTO
    {
        if (! $userEntity instanceof MagicUserEntity) {
            return null;
        }
        $targetInfoDTO = new TargetInfoDTO();
        $targetInfoDTO->setId($userEntity->getUserId());
        $targetInfoDTO->setName($userEntity->getNickname());
        $targetInfoDTO->setIcon($userEntity->getAvatarUrl());
        // 这里描述使用 部门信息
        $targetInfoDTO->setDescription('');
        return $targetInfoDTO;
    }

    public static function makeByGroup(mixed $groupEntity): ?TargetInfoDTO
    {
        if (! $groupEntity instanceof MagicGroupEntity) {
            return null;
        }
        $targetInfoDTO = new TargetInfoDTO();
        $targetInfoDTO->setId($groupEntity->getId());
        $targetInfoDTO->setName($groupEntity->getGroupName());
        $targetInfoDTO->setIcon($groupEntity->getGroupAvatar());
        $targetInfoDTO->setDescription('');
        return $targetInfoDTO;
    }

    public static function makeByDepartment(mixed $departmentEntity): ?TargetInfoDTO
    {
        if (! $departmentEntity instanceof MagicDepartmentEntity) {
            return null;
        }
        $targetInfoDTO = new TargetInfoDTO();
        $targetInfoDTO->setId($departmentEntity->getDepartmentId());
        $targetInfoDTO->setName($departmentEntity->getName());
        $targetInfoDTO->setIcon('');
        $targetInfoDTO->setDescription('');
        return $targetInfoDTO;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }
}

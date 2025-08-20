<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

class OrganizationAdminResponseDTO extends AbstractDTO
{
    public string $id;

    public string $userId;

    public string $userName = '';

    public string $avatar = '';

    public string $departmentName = '';

    public string $grantorUserName = '';

    public string $grantorUserAvatar = '';

    public string $operationTime = '';

    public bool $isOrganizationCreator = false;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function setUserName(string $userName): void
    {
        $this->userName = $userName;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): void
    {
        $this->avatar = $avatar;
    }

    public function getDepartmentName(): string
    {
        return $this->departmentName;
    }

    public function setDepartmentName(string $departmentName): void
    {
        $this->departmentName = $departmentName;
    }

    public function getGrantorUserName(): string
    {
        return $this->grantorUserName;
    }

    public function setGrantorUserName(string $grantorUserName): void
    {
        $this->grantorUserName = $grantorUserName;
    }

    public function getGrantorUserAvatar(): string
    {
        return $this->grantorUserAvatar;
    }

    public function setGrantorUserAvatar(string $grantorUserAvatar): void
    {
        $this->grantorUserAvatar = $grantorUserAvatar;
    }

    public function getOperationTime(): string
    {
        return $this->operationTime;
    }

    public function setOperationTime(string $operationTime): void
    {
        $this->operationTime = $operationTime;
    }

    public function isOrganizationCreator(): bool
    {
        return $this->isOrganizationCreator;
    }

    public function setIsOrganizationCreator(bool $isOrganizationCreator): void
    {
        $this->isOrganizationCreator = $isOrganizationCreator;
    }
}

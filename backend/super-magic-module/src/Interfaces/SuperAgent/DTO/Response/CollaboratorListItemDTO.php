<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberType;

/**
 * 协作者列表项 DTO。
 */
class CollaboratorListItemDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $userId = '';

    protected string $departmentId = '';

    protected string $name = '';

    protected string $avatarUrl = '';

    protected string $type = '';

    protected array $pathNodes = [];

    protected string $role = '';

    /**
     * 从用户协作者数据创建 DTO。
     */
    public static function fromUserData(array $userData): self
    {
        $dto = new self();
        $dto->setId($userData['id'] ?? $userData['user_id'] ?? '');
        $dto->setUserId($userData['user_id'] ?? $userData['id'] ?? '');
        $dto->setName($userData['nickname'] ?? $userData['name'] ?? '');
        $dto->setAvatarUrl($userData['avatar_url'] ?? '');
        $dto->setType(MemberType::USER->value);
        $dto->setPathNodes($userData['path_nodes'] ?? []);
        $dto->setRole($userData['role'] ?? '');

        return $dto;
    }

    /**
     * 从部门协作者数据创建 DTO。
     */
    public static function fromDepartmentData(array $departmentData): self
    {
        $dto = new self();
        $dto->setId($departmentData['id'] ?? $departmentData['department_id'] ?? '');
        $dto->setDepartmentId($departmentData['department_id'] ?? $departmentData['id'] ?? '');
        $dto->setName($departmentData['name'] ?? $departmentData['department_name'] ?? '');
        $dto->setAvatarUrl('');
        $dto->setType(MemberType::DEPARTMENT->value);
        $dto->setPathNodes($departmentData['path_nodes'] ?? []);
        $dto->setRole($departmentData['role'] ?? '');

        return $dto;
    }

    /**
     * 转为接口返回数组。
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'name' => $this->name,
            'avatar_url' => $this->avatarUrl,
            'type' => $this->type,
            'path_nodes' => $this->pathNodes,
            'role' => $this->role,
        ];

        if (MemberType::fromString($this->type)->isUser()) {
            $result['user_id'] = $this->userId;
        } elseif (MemberType::fromString($this->type)->isDepartment()) {
            $result['department_id'] = $this->departmentId;
        }

        return $result;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function setDepartmentId(string $departmentId): self
    {
        $this->departmentId = $departmentId;
        return $this;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function setAvatarUrl(string $avatarUrl): self
    {
        $this->avatarUrl = $avatarUrl;
        return $this;
    }

    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function setPathNodes(array $pathNodes): self
    {
        $this->pathNodes = $pathNodes;
        return $this;
    }

    public function setRole(string $role): self
    {
        $this->role = $role;
        return $this;
    }
}

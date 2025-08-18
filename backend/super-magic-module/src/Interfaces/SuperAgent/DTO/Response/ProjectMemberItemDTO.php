<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ProjectMemberItemDTO extends AbstractDTO
{
    /**
     * @var string 成员ID
     */
    protected string $id = '';

    /**
     * @var string 用户ID（仅用户类型）
     */
    protected string $userId = '';

    /**
     * @var string 部门ID（仅部门类型）
     */
    protected string $departmentId = '';

    /**
     * @var string 成员名称
     */
    protected string $name = '';

    /**
     * @var string 国际化名称
     */
    protected string $i18nName = '';

    /**
     * @var string 组织代码
     */
    protected string $organizationCode = '';

    /**
     * @var string 头像URL
     */
    protected string $avatarUrl = '';

    /**
     * @var string 成员类型 User|Department
     */
    protected string $type = '';

    /**
     * 从用户数据创建DTO
     */
    public static function fromUserData(array $userData): self
    {
        $dto = new self();
        $dto->setId($userData['id'] ?? $userData['user_id'] ?? '');
        $dto->setUserId($userData['user_id'] ?? $userData['id'] ?? '');
        $dto->setName($userData['nickname'] ?? $userData['name'] ?? '');
        $dto->setI18nName($userData['i18n_name'] ?? '');
        $dto->setOrganizationCode($userData['organization_code'] ?? '');
        $dto->setAvatarUrl($userData['avatar_url'] ?? '');
        $dto->setType('User');

        return $dto;
    }

    /**
     * 从部门数据创建DTO
     */
    public static function fromDepartmentData(array $departmentData): self
    {
        $dto = new self();
        $dto->setId($departmentData['id'] ?? $departmentData['department_id'] ?? '');
        $dto->setDepartmentId($departmentData['department_id'] ?? $departmentData['id'] ?? '');
        $dto->setName($departmentData['name'] ?? $departmentData['department_name'] ?? '');
        $dto->setI18nName($departmentData['i18n_name'] ?? '');
        $dto->setOrganizationCode($departmentData['organization_code'] ?? '');
        $dto->setAvatarUrl(''); // 部门通常没有头像
        $dto->setType('Department');

        return $dto;
    }

    /**
     * 转换为数组
     * 输出保持下划线命名，以保持API兼容性
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'name' => $this->name,
            'i18n_name' => $this->i18nName,
            'organization_code' => $this->organizationCode,
            'avatar_url' => $this->avatarUrl,
            'type' => $this->type,
        ];

        // 根据类型添加特定字段
        if ($this->type === 'User') {
            $result['user_id'] = $this->userId;
        } elseif ($this->type === 'Department') {
            $result['department_id'] = $this->departmentId;
        }

        return $result;
    }

    // Getters and Setters
    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getDepartmentId(): string
    {
        return $this->departmentId;
    }

    public function setDepartmentId(string $departmentId): self
    {
        $this->departmentId = $departmentId;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getI18nName(): string
    {
        return $this->i18nName;
    }

    public function setI18nName(string $i18nName): self
    {
        $this->i18nName = $i18nName;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getAvatarUrl(): string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(string $avatarUrl): self
    {
        $this->avatarUrl = $avatarUrl;
        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 更新子管理员角色请求DTO.
 */
class UpdateSubAdminRequestDTO extends AbstractDTO
{
    /**
     * 角色名称（可选，仅在需要更新时提供）.
     */
    public ?string $name = null;

    /**
     * 角色状态：0=禁用, 1=启用（可选，仅在需要更新时提供）.
     */
    public ?int $status = null;

    /**
     * 权限标签，用于前端展示分类（可选，仅在需要更新时提供）.
     */
    public ?array $permissionTag = null;

    /**
     * 权限键列表（可选，仅在需要更新时提供）.
     * 注意：如果提供了此字段，将替换所有现有权限.
     */
    public ?array $permissions = null;

    /**
     * 用户ID列表（可选，仅在需要更新时提供）.
     * 注意：如果提供了此字段，将替换所有现有用户关联.
     */
    public ?array $userIds = null;

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getPermissionTag(): ?array
    {
        return $this->permissionTag;
    }

    public function setPermissionTag(?array $permissionTag): void
    {
        $this->permissionTag = $permissionTag;
    }

    public function getPermissions(): ?array
    {
        return $this->permissions;
    }

    public function setPermissions(?array $permissions): void
    {
        $this->permissions = $permissions;
    }

    public function getUserIds(): ?array
    {
        return $this->userIds;
    }

    public function setUserIds(?array $userIds): void
    {
        $this->userIds = $userIds;
    }

    /**
     * 检查是否有需要更新的字段.
     */
    public function hasUpdates(): bool
    {
        return $this->name !== null
            || $this->status !== null
            || $this->permissionTag !== null
            || $this->permissions !== null
            || $this->userIds !== null;
    }

    /**
     * 验证DTO数据的有效性.
     */
    public function validate(): bool
    {
        // 验证角色名称（如果提供）
        if ($this->name !== null) {
            if (empty(trim($this->name))) {
                return false;
            }

            if (strlen($this->name) > 255) {
                return false;
            }
        }

        // 验证状态值（如果提供）
        if ($this->status !== null && ! in_array($this->status, [0, 1])) {
            return false;
        }

        // 验证权限列表（如果提供）
        if ($this->permissions !== null) {
            foreach ($this->permissions as $permission) {
                if (! is_string($permission)) {
                    return false;
                }
            }
        }

        // 验证用户ID列表（如果提供）
        if ($this->userIds !== null) {
            foreach ($this->userIds as $userId) {
                if (! is_string($userId)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 获取验证错误信息.
     */
    public function getValidationErrors(): array
    {
        $errors = [];

        if ($this->name !== null) {
            if (empty(trim($this->name))) {
                $errors[] = '角色名称不能为空';
            }

            if (strlen($this->name) > 255) {
                $errors[] = '角色名称长度不能超过255个字符';
            }
        }

        if ($this->status !== null && ! in_array($this->status, [0, 1])) {
            $errors[] = '角色状态值无效，只能是0或1';
        }

        if ($this->permissions !== null) {
            foreach ($this->permissions as $index => $permission) {
                if (! is_string($permission)) {
                    $errors[] = "权限列表第{$index}项必须是字符串";
                }
            }
        }

        if ($this->userIds !== null) {
            foreach ($this->userIds as $index => $userId) {
                if (! is_string($userId)) {
                    $errors[] = "用户ID列表第{$index}项必须是字符串";
                }
            }
        }

        return $errors;
    }

    /**
     * 获取所有已设置的更新字段.
     */
    public function getUpdateFields(): array
    {
        $fields = [];

        if ($this->name !== null) {
            $fields['name'] = $this->name;
        }

        if ($this->status !== null) {
            $fields['status'] = $this->status;
        }

        if ($this->permissions !== null) {
            $fields['permissions'] = $this->permissions;
        }

        if ($this->userIds !== null) {
            $fields['userIds'] = $this->userIds;
        }

        return $fields;
    }
}

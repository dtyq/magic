<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 创建子管理员角色请求DTO.
 */
class CreateSubAdminRequestDTO extends AbstractDTO
{
    /**
     * 角色名称（必填）.
     */
    public string $name = '';

    /**
     * 角色状态：0=禁用, 1=启用（默认启用）.
     */
    public int $status = 1;

    /**
     * 权限键列表（可选）.
     */
    public array $permissions = [];

    /**
     * 用户ID列表（可选）.
     */
    public array $userIds = [];

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function getPermissions(): array
    {
        return $this->permissions;
    }

    public function setPermissions(array $permissions): void
    {
        $this->permissions = $permissions;
    }

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }

    /**
     * 验证DTO数据的有效性.
     */
    public function validate(): bool
    {
        // 验证角色名称不能为空
        if (empty(trim($this->name))) {
            return false;
        }

        // 验证角色名称长度不超过255字符
        if (strlen($this->name) > 255) {
            return false;
        }

        // 验证状态值有效性
        if (! in_array($this->status, [0, 1])) {
            return false;
        }

        // 验证权限列表是否为字符串数组
        if (! empty($this->permissions)) {
            foreach ($this->permissions as $permission) {
                if (! is_string($permission)) {
                    return false;
                }
            }
        }

        // 验证用户ID列表是否为字符串数组
        if (! empty($this->userIds)) {
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
     * TODO: 需要配置多语言
     */
    public function getValidationErrors(): array
    {
        $errors = [];

        if (empty(trim($this->name))) {
            $errors[] = '角色名称不能为空';
        }

        if (strlen($this->name) > 255) {
            $errors[] = '角色名称长度不能超过255个字符';
        }

        if (! in_array($this->status, [0, 1])) {
            $errors[] = '角色状态值无效，只能是0或1';
        }

        if (! empty($this->permissions)) {
            foreach ($this->permissions as $index => $permission) {
                if (! is_string($permission)) {
                    $errors[] = "权限列表第{$index}项必须是字符串";
                }
            }
        }

        if (! empty($this->userIds)) {
            foreach ($this->userIds as $index => $userId) {
                if (! is_string($userId)) {
                    $errors[] = "用户ID列表第{$index}项必须是字符串";
                }
            }
        }

        return $errors;
    }
}

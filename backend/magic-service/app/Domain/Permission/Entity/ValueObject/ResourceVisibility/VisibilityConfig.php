<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\ResourceVisibility;

use App\Infrastructure\Core\AbstractEntity;

/**
 * 可见性配置值对象.
 */
class VisibilityConfig extends AbstractEntity
{
    protected VisibilityType $visibilityType;

    /**
     * @var VisibilityUser[]
     */
    protected array $users = [];

    /**
     * @var VisibilityDepartment[]
     */
    protected array $departments = [];

    public function getVisibilityType(): VisibilityType
    {
        return $this->visibilityType;
    }

    public function setVisibilityType(int|VisibilityType $visibilityType): void
    {
        if (is_int($visibilityType)) {
            $this->visibilityType = VisibilityType::from($visibilityType);
        } else {
            $this->visibilityType = $visibilityType;
        }
    }

    /**
     * @return VisibilityUser[]
     */
    public function getUsers(): array
    {
        return $this->users;
    }

    public function setUsers(array $users): void
    {
        $list = [];
        foreach ($users as $user) {
            if ($user instanceof VisibilityUser) {
                $list[] = $user;
            } elseif (is_array($user)) {
                $list[] = new VisibilityUser($user);
            }
        }
        $this->users = $list;
    }

    /**
     * @return VisibilityDepartment[]
     */
    public function getDepartments(): array
    {
        return $this->departments;
    }

    public function setDepartments(array $departments): void
    {
        $list = [];
        foreach ($departments as $department) {
            if ($department instanceof VisibilityDepartment) {
                $list[] = $department;
            } elseif (is_array($department)) {
                $list[] = new VisibilityDepartment($department);
            }
        }
        $this->departments = $list;
    }

    /**
     * 添加用户.
     */
    public function addUser(VisibilityUser $user): void
    {
        $this->users[] = $user;
    }

    /**
     * 添加部门.
     */
    public function addDepartment(VisibilityDepartment $department): void
    {
        $this->departments[] = $department;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'visibility_type' => $this->visibilityType->value,
            'users' => array_map(fn ($user) => $user->toArray(), $this->users),
            'departments' => array_map(fn ($dept) => $dept->toArray(), $this->departments),
        ];
    }
}

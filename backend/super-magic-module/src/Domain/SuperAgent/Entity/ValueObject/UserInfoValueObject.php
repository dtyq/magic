<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 用户信息值对象.
 */
class UserInfoValueObject
{
    /**
     * 构造函数.
     *
     * @param string $id 用户ID
     * @param string $nickname 用户昵称
     * @param string $realName 真实姓名
     * @param string $workNumber 工号
     * @param string $position 职位
     * @param array $departments 部门信息数组
     */
    public function __construct(
        private string $id = '',
        private string $nickname = '',
        private string $realName = '',
        private string $workNumber = '',
        private string $position = '',
        private array $departments = []
    ) {
        // Ensure departments are DepartmentInfoValueObject instances
        $this->departments = array_map(function ($dept) {
            return $dept instanceof DepartmentInfoValueObject
                ? $dept
                : DepartmentInfoValueObject::fromArray($dept);
        }, $this->departments);
    }

    /**
     * 从数组创建用户信息对象.
     *
     * @param array $data 用户信息数组
     */
    public static function fromArray(array $data): self
    {
        $departments = [];
        if (isset($data['departments']) && is_array($data['departments'])) {
            $departments = array_map(function ($dept) {
                return is_array($dept)
                    ? DepartmentInfoValueObject::fromArray($dept)
                    : $dept;
            }, $data['departments']);
        }

        return new self(
            $data['id'] ?? '',
            $data['nickname'] ?? '',
            $data['real_name'] ?? '',
            $data['work_number'] ?? '',
            $data['position'] ?? '',
            $departments
        );
    }

    /**
     * 转换为数组.
     *
     * @return array 用户信息数组
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nickname' => $this->nickname,
            'real_name' => $this->realName,
            'work_number' => $this->workNumber,
            'position' => $this->position,
            'departments' => array_map(fn ($dept) => $dept->toArray(), $this->departments),
        ];
    }

    // Getters
    public function getId(): string
    {
        return $this->id;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function getWorkNumber(): string
    {
        return $this->workNumber;
    }

    public function getPosition(): string
    {
        return $this->position;
    }

    /**
     * @return DepartmentInfoValueObject[]
     */
    public function getDepartments(): array
    {
        return $this->departments;
    }

    // Withers for immutability
    public function withId(string $id): self
    {
        $clone = clone $this;
        $clone->id = $id;
        return $clone;
    }

    public function withNickname(string $nickname): self
    {
        $clone = clone $this;
        $clone->nickname = $nickname;
        return $clone;
    }

    public function withRealName(string $realName): self
    {
        $clone = clone $this;
        $clone->realName = $realName;
        return $clone;
    }

    public function withWorkNumber(string $workNumber): self
    {
        $clone = clone $this;
        $clone->workNumber = $workNumber;
        return $clone;
    }

    public function withPosition(string $position): self
    {
        $clone = clone $this;
        $clone->position = $position;
        return $clone;
    }

    public function withDepartments(array $departments): self
    {
        $clone = clone $this;
        $clone->departments = array_map(function ($dept) {
            return $dept instanceof DepartmentInfoValueObject
                ? $dept
                : DepartmentInfoValueObject::fromArray($dept);
        }, $departments);
        return $clone;
    }

    /**
     * 检查用户信息是否为空.
     */
    public function isEmpty(): bool
    {
        return empty($this->id) && empty($this->nickname) && empty($this->realName);
    }

    /**
     * 检查用户信息是否有效.
     */
    public function isValid(): bool
    {
        return ! empty($this->id);
    }

    /**
     * 获取主要部门（第一个部门）.
     */
    public function getPrimaryDepartment(): ?DepartmentInfoValueObject
    {
        return $this->departments[0] ?? null;
    }

    /**
     * 检查用户是否属于指定部门.
     */
    public function belongsToDepartment(string $departmentId): bool
    {
        foreach ($this->departments as $department) {
            if ($department->getId() === $departmentId) {
                return true;
            }
        }
        return false;
    }
}

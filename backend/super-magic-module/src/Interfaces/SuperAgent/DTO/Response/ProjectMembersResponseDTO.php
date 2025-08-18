<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ProjectMembersResponseDTO extends AbstractDTO
{
    /**
     * @var ProjectMemberItemDTO[] 项目成员列表
     */
    protected array $members = [];

    /**
     * 从成员数据创建响应DTO
     *
     * @param array $users 用户数据数组
     * @param array $departments 部门数据数组
     */
    public static function fromMemberData(array $users, array $departments): self
    {
        $dto = new self();
        $members = [];

        // 处理用户数据
        foreach ($users as $userData) {
            $members[] = ProjectMemberItemDTO::fromUserData($userData);
        }

        // 处理部门数据
        foreach ($departments as $departmentData) {
            $members[] = ProjectMemberItemDTO::fromDepartmentData($departmentData);
        }

        $dto->setMembers($members);
        return $dto;
    }

    /**
     * 从空结果创建响应DTO
     */
    public static function fromEmpty(): self
    {
        $dto = new self();
        $dto->setMembers([]);
        return $dto;
    }

    /**
     * 转换为数组
     * 根据API文档，返回格式为 [[...members]]，即二维数组，但空成员时返回空数组
     */
    public function toArray(): array
    {
        $memberArrays = [];
        foreach ($this->members as $member) {
            $memberArrays[] = $member->toArray();
        }

        // 如果没有成员，返回空数组；否则返回二维数组格式
        if (empty($memberArrays)) {
            return [];
        }

        return $memberArrays;
    }

    /**
     * 获取成员列表
     *
     * @return ProjectMemberItemDTO[]
     */
    public function getMembers(): array
    {
        return $this->members;
    }

    /**
     * 设置成员列表
     *
     * @param ProjectMemberItemDTO[] $members
     */
    public function setMembers(array $members): self
    {
        $this->members = $members;
        return $this;
    }

    /**
     * 添加成员
     */
    public function addMember(ProjectMemberItemDTO $member): self
    {
        $this->members[] = $member;
        return $this;
    }

    /**
     * 获取成员总数
     */
    public function getMemberCount(): int
    {
        return count($this->members);
    }

    /**
     * 检查是否为空
     */
    public function isEmpty(): bool
    {
        return empty($this->members);
    }
}

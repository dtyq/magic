<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Core\AbstractDTO;

/**
 * 协作者成员信息DTO
 */
class CollaboratorMemberDTO extends AbstractDTO
{
    /**
     * @var string 成员ID (user_id或department_id)
     */
    protected string $id = '';

    /**
     * @var string 成员名称
     */
    protected string $name = '';

    /**
     * @var string 头像URL
     */
    protected string $avatarUrl = '';

    /**
     * @var string 成员类型 User|Department
     */
    protected string $type = '';

    /**
     * 从MagicUserEntity对象创建DTO
     */
    public static function fromUserEntity(MagicUserEntity $userEntity): self
    {
        $dto = new self();
        $dto->setId($userEntity->getUserId());
        $dto->setName($userEntity->getNickname());
        $dto->setAvatarUrl($userEntity->getAvatarUrl());
        $dto->setType('User');

        return $dto;
    }

    /**
     * 从MagicDepartmentEntity对象创建DTO
     */
    public static function fromDepartmentEntity(MagicDepartmentEntity $departmentEntity): self
    {
        $dto = new self();
        $dto->setId($departmentEntity->getDepartmentId() ?? '');
        $dto->setName($departmentEntity->getName() ?? '');
        $dto->setAvatarUrl(''); // 部门通常没有头像
        $dto->setType('Department');

        return $dto;
    }

    /**
     * 转换为数组
     */
    public function toArray(): array
    {
        $result = [
            'name' => $this->name,
            'avatar_url' => $this->avatarUrl,
            'type' => $this->type,
        ];

        // 根据类型添加对应的ID字段
        if ($this->type === 'User') {
            $result['user_id'] = $this->id;
        } elseif ($this->type === 'Department') {
            $result['department_id'] = $this->id;
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
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

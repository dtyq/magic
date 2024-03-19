<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 协作项目创建者信息 DTO.
 */
class CollaborationCreatorItemDTO extends AbstractDTO
{
    /**
     * @var string 用户ID (数字ID)
     */
    protected string $id = '';

    /**
     * @var string 用户名称
     */
    protected string $name = '';

    /**
     * @var string 用户ID (字符串ID)
     */
    protected string $userId = '';

    /**
     * @var string 头像URL
     */
    protected string $avatarUrl = '';

    /**
     * 从用户实体创建DTO.
     * @param mixed $userEntity
     */
    public static function fromUserEntity($userEntity): self
    {
        $dto = new self();
        $dto->setId((string) $userEntity->getId());
        $dto->setName($userEntity->getNickname());
        $dto->setUserId($userEntity->getUserId());
        $dto->setAvatarUrl($userEntity->getAvatarUrl() ?? '');

        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'user_id' => $this->userId,
            'avatar_url' => $this->avatarUrl,
        ];
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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
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
}

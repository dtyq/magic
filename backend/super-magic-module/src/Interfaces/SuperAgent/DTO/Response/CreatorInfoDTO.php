<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 创建人信息DTO.
 */
class CreatorInfoDTO extends AbstractDTO
{
    /**
     * @var string 用户ID
     */
    protected string $userId = '';

    /**
     * @var string 用户昵称
     */
    protected string $nickname = '';

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
        $dto->setUserId($userEntity->getUserId());
        $dto->setNickname($userEntity->getNickname());
        $dto->setAvatarUrl($userEntity->getAvatarUrl() ?? '');

        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'nickname' => $this->nickname,
            'avatar_url' => $this->avatarUrl,
        ];
    }

    // Getters and Setters
    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): self
    {
        $this->nickname = $nickname;
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

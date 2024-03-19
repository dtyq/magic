<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * 分享访问日志实体.
 */
class ResourceShareAccessLogEntity extends AbstractEntity
{
    /**
     * @var int 主键ID
     */
    protected int $id = 0;

    /**
     * @var int 分享ID（关联 magic_resource_shares.id）
     */
    protected int $shareId = 0;

    /**
     * @var string 访问时间（精确到秒）
     */
    protected string $accessTime = '';

    /**
     * @var string 用户类型：guest=游客，team_member=团队成员，anonymous=匿名用户
     */
    protected string $userType = '';

    /**
     * @var null|string 用户ID（团队成员有值，匿名用户为NULL）
     */
    protected ?string $userId = null;

    /**
     * @var null|string 用户名（用于展示）
     */
    protected ?string $userName = null;

    /**
     * @var null|string 访问者的组织代码（团队成员有值，匿名用户为NULL）
     */
    protected ?string $organizationCode = null;

    /**
     * @var null|string IP地址（用于匿名用户去重统计）
     */
    protected ?string $ipAddress = null;

    /**
     * @var null|string 创建时间
     */
    protected ?string $createdAt = null;

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getShareId(): int
    {
        return $this->shareId;
    }

    public function setShareId(int $shareId): self
    {
        $this->shareId = $shareId;
        return $this;
    }

    public function getAccessTime(): string
    {
        return $this->accessTime;
    }

    public function setAccessTime(string $accessTime): self
    {
        $this->accessTime = $accessTime;
        return $this;
    }

    public function getUserType(): string
    {
        return $this->userType;
    }

    public function setUserType(string $userType): self
    {
        $this->userType = $userType;
        return $this;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getUserName(): ?string
    {
        return $this->userName;
    }

    public function setUserName(?string $userName): self
    {
        $this->userName = $userName;
        return $this;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setIpAddress(?string $ipAddress): self
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'share_id' => $this->shareId,
            'access_time' => $this->accessTime,
            'user_type' => $this->userType,
            'user_id' => $this->userId,
            'user_name' => $this->userName,
            'organization_code' => $this->organizationCode,
            'ip_address' => $this->ipAddress,
            'created_at' => $this->createdAt,
        ];
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Entity\ValueObject;

use DateTime;

/**
 * 分享状态值对象
 * 表示分享的当前状态（有效、过期、删除等）.
 */
class ShareStatus
{
    /**
     * 状态：有效.
     */
    public const STATUS_ACTIVE = 'active';

    /**
     * 状态：过期
     */
    public const STATUS_EXPIRED = 'expired';

    /**
     * 状态：已删除.
     */
    public const STATUS_DELETED = 'deleted';

    /**
     * 状态：密码错误.
     */
    public const STATUS_PASSWORD_ERROR = 'password_error';

    /**
     * 状态：无访问权限.
     */
    public const STATUS_NO_PERMISSION = 'no_permission';

    /**
     * 当前状态值
     */
    private string $status;

    /**
     * 过期时间.
     */
    private ?DateTime $expireAt;

    /**
     * 删除时间.
     */
    private ?DateTime $deletedAt;

    /**
     * 构造函数.
     */
    private function __construct(string $status, ?DateTime $expireAt = null, ?DateTime $deletedAt = null)
    {
        $this->status = $status;
        $this->expireAt = $expireAt;
        $this->deletedAt = $deletedAt;
    }

    /**
     * 转换为字符串.
     */
    public function __toString(): string
    {
        return $this->status;
    }

    /**
     * 创建有效状态
     */
    public static function active(?DateTime $expireAt = null): self
    {
        return new self(self::STATUS_ACTIVE, $expireAt, null);
    }

    /**
     * 创建过期状态
     */
    public static function expired(DateTime $expireAt): self
    {
        return new self(self::STATUS_EXPIRED, $expireAt, null);
    }

    /**
     * 创建已删除状态
     */
    public static function deleted(DateTime $deletedAt): self
    {
        return new self(self::STATUS_DELETED, null, $deletedAt);
    }

    /**
     * 创建密码错误状态
     */
    public static function passwordError(): self
    {
        return new self(self::STATUS_PASSWORD_ERROR);
    }

    /**
     * 创建无访问权限状态
     */
    public static function noPermission(): self
    {
        return new self(self::STATUS_NO_PERMISSION);
    }

    /**
     * 获取状态值
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * 获取过期时间.
     */
    public function getExpireAt(): ?DateTime
    {
        return $this->expireAt;
    }

    /**
     * 获取删除时间.
     */
    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    /**
     * 检查状态是否为活跃.
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * 检查状态是否为过期
     */
    public function isExpired(): bool
    {
        return $this->status === self::STATUS_EXPIRED;
    }

    /**
     * 检查状态是否为已删除.
     */
    public function isDeleted(): bool
    {
        return $this->status === self::STATUS_DELETED;
    }

    /**
     * 检查状态是否为密码错误.
     */
    public function isPasswordError(): bool
    {
        return $this->status === self::STATUS_PASSWORD_ERROR;
    }

    /**
     * 检查状态是否为无访问权限.
     */
    public function isNoPermission(): bool
    {
        return $this->status === self::STATUS_NO_PERMISSION;
    }

    /**
     * 检查分享是否可访问.
     */
    public function isAccessible(): bool
    {
        return $this->isActive();
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Entity\ValueObject\GenderType;
use App\Domain\Contact\Entity\ValueObject\UserType;

class AccountEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected ?string $magicId = null;

    /**
     * 账号类型:0:ai 1:人类 2:应用.
     */
    protected ?UserType $type = null;

    /**
     * flow生成的ai code.
     */
    protected ?string $aiCode = null;

    /**
     * 账号状态,0:正常,1:禁用.
     */
    protected ?AccountStatus $status = null;

    /**
     * 手机号国家冠码
     */
    protected ?string $countryCode = null;

    /**
     * 手机号.
     */
    protected ?string $phone = null;

    protected ?string $email = null;

    protected ?string $realName = '';

    protected ?GenderType $gender = GenderType::Unknown;

    protected string $extra = '';

    protected int $magicEnvironmentId = 0;

    /**
     * 密码（SHA256加密）.
     */
    protected string $password = '';

    // 删除/更新/创建时间
    protected ?string $deletedAt = null;

    protected ?string $updatedAt = null;

    protected ?string $createdAt = null;

    // 为了追踪哪里创建的账号，留下这个构造函数
    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getMagicEnvironmentId(): int
    {
        return $this->magicEnvironmentId;
    }

    public function setMagicEnvironmentId(int $magicEnvironmentId): void
    {
        $this->magicEnvironmentId = $magicEnvironmentId;
    }

    public function getMagicId(): ?string
    {
        return $this->magicId;
    }

    public function setMagicId(null|int|string $magicId): void
    {
        if (is_int($magicId)) {
            $magicId = (string) $magicId;
        }
        $this->magicId = $magicId;
    }

    public function getCountryCode(): ?string
    {
        return $this->countryCode;
    }

    public function setCountryCode(?string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    /**
     * 获取国家代码 (state_code的别名).
     */
    public function getStateCode(): ?string
    {
        return $this->countryCode;
    }

    public function getPhone(bool $desensitization = false): string
    {
        $phone = $this->phone ?? '';
        if ($desensitization) {
            // +881 is a virtual phone
            if (self::getStateCode() === '+881') {
                return '';
            }
            $front = substr($phone, 0, 3);
            $back = substr($phone, -3);
            return $front . '****' . $back;
        }
        return $phone;
    }

    public function setPhone(?string $phone): void
    {
        $this->phone = $phone;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): void
    {
        $this->email = $email;
    }

    public function getRealName(): ?string
    {
        return $this->realName;
    }

    public function setRealName(?string $realName): void
    {
        $this->realName = $realName;
    }

    public function getExtra(): string
    {
        return $this->extra;
    }

    public function setExtra(string $extra): void
    {
        $this->extra = $extra;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getGender(): ?GenderType
    {
        return $this->gender;
    }

    public function setGender(null|GenderType|int $gender): void
    {
        if (is_int($gender)) {
            $this->gender = GenderType::from($gender);
        } else {
            $this->gender = $gender;
        }
    }

    public function getType(): ?UserType
    {
        return $this->type;
    }

    public function setType(null|int|UserType $type): void
    {
        if (is_int($type)) {
            $this->type = UserType::from($type);
        } else {
            $this->type = $type;
        }
    }

    public function getAiCode(): ?string
    {
        return $this->aiCode;
    }

    public function setAiCode(?string $aiCode): void
    {
        $this->aiCode = $aiCode;
    }

    public function getStatus(): ?AccountStatus
    {
        return $this->status;
    }

    public function setStatus(null|AccountStatus|int $status): void
    {
        if (is_int($status)) {
            $this->status = AccountStatus::from($status);
        } else {
            $this->status = $status;
        }
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): void
    {
        $this->password = $password;
    }
}

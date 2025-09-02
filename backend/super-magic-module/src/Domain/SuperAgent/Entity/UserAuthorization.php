<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Entity\ValueObject\UserType;

class UserAuthorization
{
    /**
     * 账号在某个组织下的id,即user_id.
     */
    protected string $id = '';

    /**
     * 用户注册后生成的magic_id,全局唯一
     */
    protected string $magicId = '';

    protected UserType $userType;

    /**
     * 用户在该组织下的状态:0:冻结,1:已激活,2:已离职,3:已退出.
     */
    protected string $status;

    protected string $realName = '';

    protected string $nickname = '';

    protected string $avatar = '';

    /**
     * 用户当前选择的组织.
     */
    protected string $organizationCode = '';

    protected string $applicationCode = '';

    /**
     * 手机号,不带国际冠码
     */
    protected string $mobile = '';

    /**
     * 手机号的国际冠码
     */
    protected string $countryCode = '';

    protected array $permissions = [];

    // 当前用户所处的环境id
    protected int $magicEnvId = 0;

    // 第三方平台的原始组织编码
    protected string $thirdPlatformOrganizationCode = '';

    // 第三方平台的原始用户 ID
    protected ?string $thirdPlatformUserId = '';

    // 第三方平台类型
    protected ?PlatformType $thirdPlatformType = null;

    public function __construct()
    {
    }

    public function getUserType(): UserType
    {
        return $this->userType;
    }

    public function setUserType(UserType $userType): static
    {
        $this->userType = $userType;
        return $this;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    public function getMobile(): string
    {
        return $this->mobile;
    }

    public function setMobile(string $mobile): void
    {
        $this->mobile = $mobile;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): UserAuthorization
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): UserAuthorization
    {
        $this->realName = $realName;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): UserAuthorization
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getApplicationCode(): string
    {
        return $this->applicationCode;
    }

    public function setApplicationCode(string $applicationCode): UserAuthorization
    {
        $this->applicationCode = $applicationCode;
        return $this;
    }

    public function getPermissions(): array
    {
        return $this->permissions;
    }

    public function setPermissions(array $permissions): void
    {
        $this->permissions = $permissions;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): UserAuthorization
    {
        $this->id = $id;
        return $this;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): UserAuthorization
    {
        $this->nickname = $nickname;
        return $this;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): void
    {
        $this->magicId = $magicId;
    }

    public function getMagicEnvId(): int
    {
        return $this->magicEnvId;
    }

    public function setMagicEnvId(int $magicEnvId): void
    {
        $this->magicEnvId = $magicEnvId;
    }

    public function getThirdPlatformOrganizationCode(): string
    {
        return $this->thirdPlatformOrganizationCode;
    }

    public function setThirdPlatformOrganizationCode(string $thirdPlatformOrganizationCode): void
    {
        $this->thirdPlatformOrganizationCode = $thirdPlatformOrganizationCode;
    }

    public function getThirdPlatformUserId(): string
    {
        return $this->thirdPlatformUserId;
    }

    public function setThirdPlatformUserId(string $thirdPlatformUserId): void
    {
        $this->thirdPlatformUserId = $thirdPlatformUserId;
    }

    public function getThirdPlatformType(): PlatformType
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(null|PlatformType|string $thirdPlatformType): static
    {
        if (is_string($thirdPlatformType)) {
            $this->thirdPlatformType = PlatformType::from($thirdPlatformType);
        } else {
            $this->thirdPlatformType = $thirdPlatformType;
        }
        return $this;
    }

    public static function fromUserEntity(MagicUserEntity $userEntity): UserAuthorization
    {
        $authorization = new UserAuthorization();
        $authorization->setId($userEntity->getUserId());
        $authorization->setMagicId($userEntity->getMagicId());
        $authorization->setOrganizationCode($userEntity->getOrganizationCode());
        $authorization->setUserType($userEntity->getUserType());
        return $authorization;
    }
}

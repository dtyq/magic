<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authorization\PersonalAccessToken;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Qbhy\HyperfAuth\Authenticatable;

class PersonalAccessTokenAuthorization extends AbstractAuthorization
{
    /**
     * 用户ID.
     */
    protected string $id = '';

    /**
     * 用户注册后生成的magic_id,全局唯一.
     */
    protected string $magicId = '';

    protected UserType $userType;

    /**
     * 用户状态.
     */
    protected string $status;

    protected string $realName = '';

    protected string $nickname = '';

    protected string $avatar = '';

    /**
     * 用户所属组织.
     */
    protected string $organizationCode = '';

    protected string $applicationCode = '';

    /**
     * 手机号,不带国际冠码.
     */
    protected string $mobile = '';

    /**
     * 手机号的国际冠码.
     */
    protected string $countryCode = '';

    protected array $permissions = [];

    protected int $magicEnvId = 0;

    public function __construct()
    {
    }

    /**
     * 通过Personal Access Token进行鉴权.
     * @param mixed $key
     */
    public static function retrieveById($key): ?Authenticatable
    {
        $token = (string) ($key['token'] ?? '');

        if ($token === '') {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 转为短token
        $shortToken = MagicTokenEntity::getShortToken($token);

        /** @var MagicTokenRepositoryInterface $magicTokenRepository */
        $magicTokenRepository = di(MagicTokenRepositoryInterface::class);

        // 查询token
        $tokenEntity = $magicTokenRepository->queryTokenEntity(
            MagicTokenType::PersonalAccessToken,
            $shortToken,
            true // 检查过期
        );

        if ($tokenEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 获取用户ID
        $userId = $tokenEntity->getTypeRelationValue();
        if ($userId === '') {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 加载用户信息
        $userDomainService = di(MagicUserDomainService::class);
        $accountDomainService = di(MagicAccountDomainService::class);

        $userEntity = $userDomainService->getUserById($userId);
        if ($userEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        $magicAccountEntity = $accountDomainService->getAccountInfoByMagicId($userEntity->getMagicId());
        if ($magicAccountEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 构建Authorization对象
        $authorization = new self();
        $authorization->setId($userEntity->getUserId());
        $authorization->setNickname($userEntity->getNickname());
        $authorization->setAvatar($userEntity->getAvatarUrl());
        $authorization->setStatus((string) $userEntity->getStatus()->value);
        $authorization->setOrganizationCode($userEntity->getOrganizationCode());
        $authorization->setMagicId($userEntity->getMagicId());
        $authorization->setMobile($magicAccountEntity->getPhone());
        $authorization->setCountryCode($magicAccountEntity->getCountryCode());
        $authorization->setRealName($magicAccountEntity->getRealName());
        $authorization->setUserType($userEntity->getUserType());

        return $authorization;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
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

    public function getUserType(): UserType
    {
        return $this->userType;
    }

    public function setUserType(UserType $userType): self
    {
        $this->userType = $userType;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): self
    {
        $this->realName = $realName;
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

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): self
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getApplicationCode(): string
    {
        return $this->applicationCode;
    }

    public function setApplicationCode(string $applicationCode): self
    {
        $this->applicationCode = $applicationCode;
        return $this;
    }

    public function getMobile(): string
    {
        return $this->mobile;
    }

    public function setMobile(string $mobile): void
    {
        $this->mobile = $mobile;
    }

    public function getCountryCode(): string
    {
        return $this->countryCode;
    }

    public function setCountryCode(string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    public function getPermissions(): array
    {
        return $this->permissions;
    }

    public function setPermissions(array $permissions): void
    {
        $this->permissions = $permissions;
    }

    public function getMagicEnvId(): int
    {
        return $this->magicEnvId;
    }

    public function setMagicEnvId(int $magicEnvId): void
    {
        $this->magicEnvId = $magicEnvId;
    }

    public static function fromUserEntity(MagicUserEntity $userEntity): self
    {
        $authorization = new self();
        $authorization->setId($userEntity->getUserId());
        $authorization->setMagicId($userEntity->getMagicId());
        $authorization->setOrganizationCode($userEntity->getOrganizationCode());
        $authorization->setUserType($userEntity->getUserType());
        return $authorization;
    }
}

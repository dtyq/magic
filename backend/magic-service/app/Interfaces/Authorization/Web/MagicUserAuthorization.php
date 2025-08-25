<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authorization\Web;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Domain\Authentication\DTO\LoginCheckDTO;
use App\Domain\Authentication\DTO\LoginResponseDTO;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Contract\Session\SessionInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * 如果改了这个类的名称/属性/命名空间，请修改 WebUserGuard.php 的 cacheKey ，避免缓存无法还原
 */
class MagicUserAuthorization extends AbstractAuthorization
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

    public static function retrieveById($key): ?Authenticatable
    {
        $organizationCode = $key['organizationCode'] ?? '';
        $authorization = $key['authorization'] ?? '';
        if (empty($authorization) || empty($organizationCode)) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }
        $userDomainService = di(MagicUserDomainService::class);
        $accountDomainService = di(MagicAccountDomainService::class);
        $magicEnvDomainService = di(MagicOrganizationEnvDomainService::class);
        $sessionInterface = di(SessionInterface::class);

        $superMagicAgentUserId = $key['superMagicAgentUserId'] ?? '';
        if ($superMagicAgentUserId) {
            // 处理超级麦吉的 agent 用户
            $sandboxToken = config('super-magic.sandbox.token', '');
            if (empty($sandboxToken) || $sandboxToken !== $authorization) {
                ExceptionBuilder::throw(UserErrorCode::TOKEN_NOT_FOUND, 'token error');
            }
            $magicUserId = $superMagicAgentUserId;
            $magicEnvEntity = null;
            $loginResponseDTO = null;
            // 直接登录
            goto create_user;
        }

        // 多环境下 $authorization 可能重复，会有问题（概率趋近无穷小）
        $magicEnvEntity = $magicEnvDomainService->getEnvironmentEntityByAuthorization($authorization);
        if ($magicEnvEntity === null) {
            $magicEnvEntity = $magicEnvDomainService->getCurrentDefaultMagicEnv();
            if ($magicEnvEntity === null) {
                // token没有绑定环境，且没有默认环境配置
                ExceptionBuilder::throw(ChatErrorCode::MAGIC_ENVIRONMENT_NOT_FOUND);
            }
        }
        // 如果是麦吉自己下发的 Token,就由自己校验
        $loginCheckDTO = new LoginCheckDTO();
        $loginCheckDTO->setAuthorization($authorization);
        /** @var LoginResponseDTO[] $currentEnvMagicOrganizationUsers */
        $currentEnvMagicOrganizationUsers = $sessionInterface->loginCheck($loginCheckDTO, $magicEnvEntity, $organizationCode);
        $currentEnvMagicOrganizationUsers = array_column($currentEnvMagicOrganizationUsers, null, 'magic_organization_code');
        $loginResponseDTO = $currentEnvMagicOrganizationUsers[$organizationCode] ?? null;
        if ($loginResponseDTO === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        $magicUserId = $loginResponseDTO->getMagicUserId();
        if (empty($magicUserId)) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }

        create_user:
        $userEntity = $userDomainService->getUserById($magicUserId);
        if ($userEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        $magicAccountEntity = $accountDomainService->getAccountInfoByMagicId($userEntity->getMagicId());
        if ($magicAccountEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        $magicUserInfo = new self();
        $magicUserInfo->setId($userEntity->getUserId());
        $magicUserInfo->setNickname($userEntity->getNickname());
        $magicUserInfo->setAvatar($userEntity->getAvatarUrl());
        $magicUserInfo->setStatus((string) $userEntity->getStatus()->value);
        $magicUserInfo->setOrganizationCode($userEntity->getOrganizationCode());
        $magicUserInfo->setMagicId($userEntity->getMagicId());
        $magicUserInfo->setMagicEnvId($magicEnvEntity?->getId() ?? 0);
        $magicUserInfo->setMobile($magicAccountEntity->getPhone());
        $magicUserInfo->setCountryCode($magicAccountEntity->getCountryCode());
        $magicUserInfo->setRealName($magicAccountEntity->getRealName());
        $magicUserInfo->setUserType($userEntity->getUserType());
        $magicUserInfo->setThirdPlatformUserId($loginResponseDTO?->getThirdPlatformUserId() ?? '');
        $magicUserInfo->setThirdPlatformOrganizationCode($loginResponseDTO?->getThirdPlatformOrganizationCode() ?? '');
        return $magicUserInfo;
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

    public function setAvatar(string $avatar): MagicUserAuthorization
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getRealName(): string
    {
        return $this->realName;
    }

    public function setRealName(string $realName): MagicUserAuthorization
    {
        $this->realName = $realName;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): MagicUserAuthorization
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getApplicationCode(): string
    {
        return $this->applicationCode ?: AppCodeEnum::SUPER_MAGIC->value;
    }

    public function setApplicationCode(string $applicationCode): MagicUserAuthorization
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

    public function setId(string $id): MagicUserAuthorization
    {
        $this->id = $id;
        return $this;
    }

    public function getNickname(): string
    {
        return $this->nickname;
    }

    public function setNickname(string $nickname): MagicUserAuthorization
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

    public static function fromUserEntity(MagicUserEntity $userEntity): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setId($userEntity->getUserId());
        $authorization->setMagicId($userEntity->getMagicId());
        $authorization->setOrganizationCode($userEntity->getOrganizationCode());
        $authorization->setUserType($userEntity->getUserType());
        return $authorization;
    }
}

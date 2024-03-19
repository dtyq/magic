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
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Token\Entity\MagicTokenEntity;
use App\Domain\Token\Entity\ValueObject\MagicTokenType;
use App\Domain\Token\Repository\Facade\MagicTokenRepositoryInterface;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Contract\Session\SessionInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Carbon\Carbon;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

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

    /**
     * 支持两种鉴权模式：
     * 1. Web场景：authorization（账号级别token）+ organizationCode
     * 2. 个人级别token（沙箱场景）：authorization（个人级别token），无 organizationCode.
     * @param mixed $key
     */
    public static function retrieveById($key): ?Authenticatable
    {
        $authorization = (string) ($key['authorization'] ?? '');
        $organizationCode = (string) ($key['organizationCode'] ?? '');

        if ($authorization === '') {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 查询 magic_tokens 表确定 token 类型
        $shortToken = MagicTokenEntity::getShortToken($authorization);

        /** @var MagicTokenRepositoryInterface $magicTokenRepository */
        $magicTokenRepository = di(MagicTokenRepositoryInterface::class);
        $tokenEntity = $magicTokenRepository->getTokenEntityByToken($shortToken);

        if ($tokenEntity === null) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        // 尝试自动续期
        self::tryRenewToken($tokenEntity);

        // 个人级别token（MagicTokenType::User）走个人级别鉴权流程
        if ($tokenEntity->getType() === MagicTokenType::User) {
            $userId = $tokenEntity->getTypeRelationValue();
            if ($userId === '') {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            }
            $authorization = self::createAuthorizationByUserId($userId, null, null);
            self::getLogger()?->info('AuthFlow user-token success', [
                'user_id' => $authorization->getId(),
                'organization_code' => $authorization->getOrganizationCode(),
                'token_type' => $tokenEntity->getType()->value,
            ]);
            return $authorization;
        }

        // 账号级别token需要 organizationCode
        if ($organizationCode === '') {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_EXIST);
        }
        // 组织级别的 authorization 鉴权
        return self::retrieveByWebAuthorization($authorization, $organizationCode);
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

    private static function retrieveByWebAuthorization(string $authorization, string $organizationCode): self
    {
        $magicEnvDomainService = di(MagicOrganizationEnvDomainService::class);
        $sessionInterface = di(SessionInterface::class);

        $magicEnvEntity = $magicEnvDomainService->getEnvironmentEntityByAuthorization($authorization);
        if ($magicEnvEntity === null) {
            $magicEnvEntity = $magicEnvDomainService->getCurrentDefaultMagicEnv();
            if ($magicEnvEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::MAGIC_ENVIRONMENT_NOT_FOUND);
            }
        }

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
        if ($magicUserId === '') {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }

        return self::createAuthorizationByUserId($magicUserId, $magicEnvEntity, $loginResponseDTO);
    }

    private static function createAuthorizationByUserId(
        string $magicUserId,
        ?MagicEnvironmentEntity $magicEnvEntity,
        ?LoginResponseDTO $loginResponseDTO
    ): self {
        if ($magicUserId === '') {
            ExceptionBuilder::throw(ChatErrorCode::LOGIN_FAILED);
        }
        $userDomainService = di(MagicUserDomainService::class);
        $accountDomainService = di(MagicAccountDomainService::class);

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
        $magicUserInfo->setThirdPlatformType($loginResponseDTO?->getThirdPlatformType());
        return $magicUserInfo;
    }

    private static function getLogger(): ?LoggerInterface
    {
        try {
            /** @var LoggerFactory $loggerFactory */
            $loggerFactory = di(LoggerFactory::class);
            return $loggerFactory->get('MagicUserAuthorization');
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * 尝试自动续期 Token.
     */
    private static function tryRenewToken(MagicTokenEntity $tokenEntity): void
    {
        try {
            $expiredAt = Carbon::parse($tokenEntity->getExpiredAt());
            $now = Carbon::now();

            if ($expiredAt->isPast()) {
                return;
            }

            // 如果剩余时间少于 7 天，则自动续期到 30 天后
            if ($now->diffInDays($expiredAt, false) < 7) {
                $newExpiredAt = $now->copy()->addDays(30)->toDateTimeString();
                $tokenEntity->setExpiredAt($newExpiredAt);

                $repository = di(MagicTokenRepositoryInterface::class);
                $repository->refreshTokenExpiration($tokenEntity);

                self::getLogger()?->info('AuthFlow token auto-renewed', [
                    'token_id' => $tokenEntity->getId(),
                    'old_expired_at' => $expiredAt->toDateTimeString(),
                    'new_expired_at' => $newExpiredAt,
                ]);
            }
        } catch (Throwable $e) {
            self::getLogger()?->error('AuthFlow token auto-renew failed', [
                'error' => $e->getMessage(),
                'token_id' => $tokenEntity->getId(),
            ]);
        }
    }
}

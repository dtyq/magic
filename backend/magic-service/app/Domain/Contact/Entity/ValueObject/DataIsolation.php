<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Util\Context\CoContext;
use InvalidArgumentException;

/**
 * Contact 领域使用的数据隔离对象。
 *
 * 该对象只保存隔离上下文和 Contact 扩展字段，不依赖其他领域服务。
 */
class DataIsolation extends BaseDataIsolation
{
    /** 当前应用 ID。 */
    protected ?string $currentAppId = null;

    /** 当前用户类型。 */
    protected ?UserType $userType = null;

    /** 显式覆盖的语言。 */
    protected ?string $language = null;

    /**
     * 创建 Contact 数据隔离对象，兼容旧版数组构造方式。
     *
     * @param null|array<string, mixed>|string $currentOrganizationCode 组织编码或旧版属性数组
     */
    public function __construct(null|array|string $currentOrganizationCode = '', string $userId = '', string $magicId = '', ?array $data = null)
    {
        if ($data !== null) {
            if ($currentOrganizationCode !== '' && $currentOrganizationCode !== null || $userId !== '' || $magicId !== '') {
                throw new InvalidArgumentException('旧版数组与基础隔离构造参数不能同时指定');
            }
            $currentOrganizationCode = $data;
        }
        if (is_array($currentOrganizationCode)) {
            $data = $currentOrganizationCode;
            $userType = $data['user_type'] ?? null;
            parent::__construct(
                (string) ($data['current_organization_code'] ?? ''),
                (string) ($data['current_user_id'] ?? ''),
                (string) ($data['magic_id'] ?? $data['current_magic_id'] ?? '')
            );

            if (is_numeric($userType)) {
                $this->setUserType(UserType::from((int) $userType));
            } elseif ($userType instanceof UserType) {
                $this->setUserType($userType);
            }
            $this->setCurrentAppId(isset($data['current_app_id']) ? (string) $data['current_app_id'] : null);
            $this->setThirdPartyOrganizationCode($data['third_party_organization_code'] ?? null);
            $this->setLanguage($data['language'] ?? null);
            $this->setUserAuthorizationToken($data['user_authorization_token'] ?? null);
            if (isset($data['environment'])) {
                $this->setEnvironment((string) $data['environment']);
            }
            return;
        }

        parent::__construct((string) ($currentOrganizationCode ?? ''), $userId, $magicId);
    }

    /**
     * 创建 Contact 数据隔离对象。
     */
    public static function create(string $currentOrganizationCode = '', string $userId = '', string $magicId = ''): self
    {
        return new self($currentOrganizationCode, $userId, $magicId);
    }

    /**
     * 创建仅包含环境信息的数据隔离对象。
     */
    public static function simpleMakeOnlyEnvironment(): self
    {
        return self::create();
    }

    /**
     * 创建兼容旧调用方式的数据隔离对象。
     */
    public static function simpleMake(string $currentOrganizationCode, ?string $userId = null): self
    {
        return self::create($currentOrganizationCode, (string) $userId);
    }

    /**
     * 获取用户类型；未显式设置时按当前用户查询。
     */
    public function getUserType(): ?UserType
    {
        if ($this->userType === null && $this->getCurrentUserId() !== '') {
            $userEntity = di(MagicUserRepositoryInterface::class)->getUserById($this->getCurrentUserId());
            if ($userEntity !== null) {
                $this->setUserType($userEntity->getUserType());
            }
        }
        return $this->userType;
    }

    /**
     * 设置用户类型。
     */
    public function setUserType(?UserType $userType): void
    {
        $this->userType = $userType;
    }

    /**
     * 获取第三方组织编码。
     */
    public function getThirdPartyOrganizationCode(): string
    {
        return parent::getThirdPlatformOrganizationCode();
    }

    /**
     * 设置第三方组织编码。
     */
    public function setThirdPartyOrganizationCode(?string $thirdPartyOrganizationCode): static
    {
        return parent::setThirdPlatformOrganizationCode($thirdPartyOrganizationCode);
    }

    /**
     * 获取兼容旧命名的 Magic ID。
     */
    public function getCurrentMagicId(): string
    {
        return $this->getMagicId();
    }

    /**
     * 设置兼容旧命名的 Magic ID。
     */
    public function setCurrentMagicId(string $currentMagicId): static
    {
        return $this->setMagicId($currentMagicId);
    }

    /**
     * 获取当前应用 ID。
     */
    public function getCurrentAppId(): ?string
    {
        return $this->currentAppId;
    }

    /**
     * 设置当前应用 ID。
     */
    public function setCurrentAppId(?string $currentAppId): void
    {
        $this->currentAppId = $currentAppId;
    }

    /**
     * 设置当前组织编码。
     */
    public function setCurrentOrganizationCode(string $currentOrganizationCode): static
    {
        return parent::setCurrentOrganizationCode($currentOrganizationCode);
    }

    /**
     * 设置当前用户 ID。
     */
    public function setCurrentUserId(?string $currentUserId): static
    {
        return parent::setCurrentUserId($currentUserId ?? '');
    }

    /**
     * 获取当前语言。
     */
    public function getLanguage(): string
    {
        return $this->language ?? CoContext::getLanguage();
    }

    /**
     * 设置当前语言。
     */
    public function setLanguage(?string $language): void
    {
        $this->language = $language;
    }

    /** 身份变化时同时失效Contact的用户类型缓存。 */
    protected function resetIdentityCapabilities(): void
    {
        parent::resetIdentityCapabilities();
        $this->userType = null;
    }
}

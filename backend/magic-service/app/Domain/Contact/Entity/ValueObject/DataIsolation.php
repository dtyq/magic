<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

use App\Domain\Contact\Repository\Facade\MagicUserRepositoryInterface;
use App\Infrastructure\Core\AbstractObject;

/**
 * 数据隔离 SaaS化
 * 目前仅有组织隔离
 * 显式传入，防止隐式传入，导致不知道哪些地方需要做隔离.
 */
class DataIsolation extends AbstractObject
{
    /**
     * 当前的账号id. 所有账号统一注意隐私保护,不对第三方返回.
     */
    protected string $currentMagicId = '';

    /**
     * 当前的组织编码.
     */
    protected string $currentOrganizationCode = '';

    /**
     * 当前的组织下的用户id.
     */
    protected ?string $currentUserId = null;

    /**
     * 当前环境.
     */
    protected string $environment;

    /**
     * 当前应用id.
     */
    protected ?string $currentAppId = null;

    /**
     * 第三方平台组织编码.
     */
    protected ?string $thirdPartyOrganizationCode = null;

    protected ?UserType $userType = null;

    protected ?string $language = null;

    public function __construct(?array $data = null)
    {
        if (isset($data['user_type']) && is_numeric($data['user_type'])) {
            $data['user_type'] = UserType::from((int) $data['user_type']);
        }
        $this->environment = app_env();
        parent::__construct($data);
    }

    public function getUserType(): ?UserType
    {
        if (empty($this->userType) && ! empty($this->getCurrentUserId())) {
            $userEntity = di(MagicUserRepositoryInterface::class)->getUserById($this->getCurrentUserId());
            $userEntity && $this->setUserType($userEntity->getUserType());
        }
        return $this->userType;
    }

    public function setUserType(?UserType $userType): void
    {
        $this->userType = $userType;
    }

    public function getThirdPartyOrganizationCode(): ?string
    {
        return $this->thirdPartyOrganizationCode;
    }

    public function setThirdPartyOrganizationCode(?string $thirdPartyOrganizationCode): void
    {
        $this->thirdPartyOrganizationCode = $thirdPartyOrganizationCode;
    }

    public static function create(string $currentOrganizationCode = '', string $userId = ''): self
    {
        $static = new self();
        $static->setCurrentOrganizationCode(currentOrganizationCode: $currentOrganizationCode);
        $static->setCurrentUserId(currentUserId: $userId);
        return $static;
    }

    public function getCurrentMagicId(): string
    {
        return $this->currentMagicId;
    }

    public function setCurrentMagicId(string $currentMagicId): void
    {
        $this->currentMagicId = $currentMagicId;
    }

    public function getCurrentAppId(): ?string
    {
        return $this->currentAppId;
    }

    public function setCurrentAppId(?string $currentAppId): void
    {
        $this->currentAppId = $currentAppId;
    }

    public function getCurrentOrganizationCode(): string
    {
        return $this->currentOrganizationCode;
    }

    public function setCurrentOrganizationCode(string $currentOrganizationCode): void
    {
        $this->currentOrganizationCode = $currentOrganizationCode;
    }

    public function getCurrentUserId(): ?string
    {
        return $this->currentUserId;
    }

    public function setCurrentUserId(?string $currentUserId): void
    {
        $this->currentUserId = $currentUserId;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function setEnvironment(string $environment): void
    {
        $this->environment = $environment;
    }

    public static function simpleMake(string $currentOrganizationCode, ?string $userId = null): DataIsolation
    {
        $dataIsolation = new DataIsolation();
        $dataIsolation->setCurrentOrganizationCode(currentOrganizationCode: $currentOrganizationCode);
        $dataIsolation->setCurrentUserId(currentUserId: $userId);
        return $dataIsolation;
    }

    public static function simpleMakeOnlyEnvironment(): DataIsolation
    {
        return new DataIsolation();
    }

    public function isEnable(): bool
    {
        return true;
    }

    public function getLanguage(): ?string
    {
        return $this->language;
    }

    public function setLanguage(?string $language): void
    {
        $this->language = $language;
    }
}

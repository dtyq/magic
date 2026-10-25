<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation;

use App\Infrastructure\Util\Context\CoContext;

/** 通用数据隔离上下文及实例级延迟状态。 */
class BaseDataIsolation implements DataIsolationInterface
{
    /** 延迟初始化用户授权 token 的函数标识。 */
    public const USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION = 'initUserAuthorizationToken';

    /**
     * 当前的组织编码.
     */
    private string $currentOrganizationCode;

    /**
     * 当前的用户id.
     */
    private string $currentUserId;

    private string $magicId;

    /**
     * 当前环境 app_env().
     */
    private string $environment;

    private bool $enabled = true;

    /**
     * 多组织下的环境 ID.
     */
    private int $envId = 0;

    private ThirdPlatformDataIsolationManagerInterface $thirdPlatformDataIsolationManager;

    private string $thirdPlatformUserId;

    private string $thirdPlatformOrganizationCode;

    /**
     * 是否包含官方组织.
     */
    private bool $containOfficialOrganization = false;

    /**
     * 是否仅仅包含官方组织.
     */
    private bool $onlyOfficialOrganization = false;

    /**
     * 官方组织codes.
     */
    private array $officialOrganizationCodes = [];

    private SubscriptionManagerInterface $subscriptionManager;

    private OrganizationInfoManagerInterface $organizationInfoManager;

    private array $lazyFunctions = [];

    /** 派生能力变更版本，避免状态回到原值时误用初始化标记。 */
    private int $initializationVersion = 0;

    /** 当前用户的沙箱授权 token。 */
    private ?string $userAuthorizationToken = null;

    public function __construct(string $currentOrganizationCode = '', string $userId = '', string $magicId = '')
    {
        $this->environment = app_env();
        $this->currentOrganizationCode = $currentOrganizationCode;
        $this->currentUserId = $userId;
        $this->magicId = $magicId;
        $this->thirdPlatformDataIsolationManager = \Hyperf\Support\make(ThirdPlatformDataIsolationManagerInterface::class);
        $this->subscriptionManager = \Hyperf\Support\make(SubscriptionManagerInterface::class);
        $this->organizationInfoManager = \Hyperf\Support\make(OrganizationInfoManagerInterface::class);

        if (config('service_provider.office_organization')) {
            // 目前只有 1 个官方组织
            $this->officialOrganizationCodes = [config('service_provider.office_organization')];
        }
    }

    /** 提供派生能力变更版本供初始化器识别失效状态。 */
    public function getInitializationVersion(): int
    {
        return $this->initializationVersion;
    }

    /** 在应用边界准备当前实例的环境能力，保持显式组织和用户不变。 */
    public function initDataIsolationEnv(int $envId = 0, bool $force = false): static
    {
        di(DataIsolationInitializerInterface::class)->initialize($this, $envId, $force);
        return $this;
    }

    public static function createByBaseDataIsolation(BaseDataIsolation $baseDataIsolation): static
    {
        /* @phpstan-ignore-next-line */
        $self = new static(
            currentOrganizationCode: $baseDataIsolation->getCurrentOrganizationCode(),
            userId: $baseDataIsolation->getCurrentUserId(),
            magicId: $baseDataIsolation->getMagicId()
        );
        $self->extends($baseDataIsolation);
        return $self;
    }

    public function getThirdPlatformDataIsolationManager(): ThirdPlatformDataIsolationManagerInterface
    {
        return $this->thirdPlatformDataIsolationManager;
    }

    public function extends(DataIsolationInterface $parentDataIsolation): void
    {
        $this->setCurrentOrganizationCode($parentDataIsolation->getCurrentOrganizationCode());
        $this->setCurrentUserId($parentDataIsolation->getCurrentUserId());
        $this->magicId = $parentDataIsolation->getMagicId();
        $this->envId = $parentDataIsolation->getEnvId();
        $this->enabled = $parentDataIsolation->isEnable();
        $this->subscriptionManager = $parentDataIsolation->getSubscriptionManager();
        $this->organizationInfoManager = $parentDataIsolation->getOrganizationInfoManager();

        $this->thirdPlatformOrganizationCode = $parentDataIsolation->getThirdPlatformOrganizationCode();
        $this->thirdPlatformUserId = $parentDataIsolation->getThirdPlatformUserId();
        $this->thirdPlatformDataIsolationManager->extends($parentDataIsolation);
    }

    public function getOrganizationCodes(): array
    {
        if ($this->onlyOfficialOrganization) {
            return $this->officialOrganizationCodes;
        }
        if (! empty($this->currentOrganizationCode)) {
            $organizationCodes = [$this->currentOrganizationCode];
        } else {
            $organizationCodes = [];
        }
        if ($this->containOfficialOrganization) {
            $organizationCodes = array_merge($organizationCodes, $this->officialOrganizationCodes);
        }
        return array_unique($organizationCodes);
    }

    public function getCurrentOrganizationCode(): string
    {
        return $this->currentOrganizationCode;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    /**
     * 设置当前环境。
     */
    public function setEnvironment(string $environment): static
    {
        $this->environment = $environment;
        return $this;
    }

    public function getCurrentUserId(): string
    {
        return $this->currentUserId;
    }

    public function isEnable(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): static
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function disabled(): static
    {
        $this->enabled = false;
        return $this;
    }

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): static
    {
        $this->magicId = $magicId;
        return $this;
    }

    public function getEnvId(): int
    {
        return $this->envId;
    }

    /** 环境切换时失效原环境的派生能力，保留当前用户的显式授权。 */
    public function setEnvId(int $envId): static
    {
        if ($this->envId !== 0 && $this->envId !== $envId) {
            ++$this->initializationVersion;
            $this->thirdPlatformUserId = '';
            $this->thirdPlatformOrganizationCode = '';
            $this->removeLazyFunction('initSubscription');
            $this->subscriptionManager = \Hyperf\Support\make(SubscriptionManagerInterface::class);
            $this->thirdPlatformDataIsolationManager = \Hyperf\Support\make(ThirdPlatformDataIsolationManagerInterface::class);
        }
        $this->envId = $envId;
        return $this;
    }

    /** 设置隔离身份，身份变化时清除旧授权状态。 */
    public function setCurrentUserId(string $currentUserId): static
    {
        if ($this->currentUserId !== $currentUserId) {
            $this->resetIdentityCapabilities();
        }
        $this->currentUserId = $currentUserId;
        return $this;
    }

    public function getThirdPlatformUserId(): string
    {
        return $this->thirdPlatformUserId ?? '';
    }

    public function setThirdPlatformUserId(?string $thirdPlatformUserId): static
    {
        $this->thirdPlatformUserId = $thirdPlatformUserId ?? '';
        return $this;
    }

    public function getThirdPlatformOrganizationCode(): string
    {
        return $this->thirdPlatformOrganizationCode ?? '';
    }

    public function setThirdPlatformOrganizationCode(?string $thirdPlatformOrganizationCode): static
    {
        $this->thirdPlatformOrganizationCode = $thirdPlatformOrganizationCode ?? '';
        return $this;
    }

    /** 设置隔离身份，身份变化时清除旧授权状态。 */
    public function setCurrentOrganizationCode(string $currentOrganizationCode): static
    {
        if ($this->currentOrganizationCode !== $currentOrganizationCode) {
            $this->resetIdentityCapabilities();
            $this->envId = 0;
            $this->organizationInfoManager = \Hyperf\Support\make(OrganizationInfoManagerInterface::class);
        }
        $this->currentOrganizationCode = $currentOrganizationCode;
        return $this;
    }

    public function isContainOfficialOrganization(): bool
    {
        return $this->containOfficialOrganization;
    }

    public function setContainOfficialOrganization(bool $containOfficialOrganization): void
    {
        $this->containOfficialOrganization = $containOfficialOrganization;
    }

    public function isOnlyOfficialOrganization(): bool
    {
        return $this->onlyOfficialOrganization;
    }

    public function setOnlyOfficialOrganization(bool $onlyOfficialOrganization): void
    {
        $this->onlyOfficialOrganization = $onlyOfficialOrganization;
    }

    public function getOfficialOrganizationCodes(): array
    {
        return $this->officialOrganizationCodes;
    }

    public function getOfficialOrganizationCode(): string
    {
        return $this->officialOrganizationCodes[0] ?? '';
    }

    public function setOfficialOrganizationCodes(array $officialOrganizationCodes): void
    {
        $this->officialOrganizationCodes = $officialOrganizationCodes;
    }

    public function isOfficialOrganization(): bool
    {
        return in_array($this->currentOrganizationCode, $this->officialOrganizationCodes, true);
    }

    public function getLanguage(): string
    {
        return CoContext::getLanguage();
    }

    public function getSubscriptionManager(): SubscriptionManagerInterface
    {
        $this->runLazyFunction('initSubscription');
        return $this->subscriptionManager;
    }

    public function getOrganizationInfoManager(): OrganizationInfoManagerInterface
    {
        $this->runLazyFunction('initOrganizationInfo');
        return $this->organizationInfoManager;
    }

    /**
     * 获取当前用户的授权 token。
     *
     * 授权 token 由应用层通过延迟函数注册，只有实际读取时才执行查询。
     */
    public function getUserAuthorizationToken(): ?string
    {
        if ($this->userAuthorizationToken === null) {
            $token = $this->runLazyFunction(self::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION);
            if (is_string($token)) {
                $this->userAuthorizationToken = $token;
            }
        }
        return $this->userAuthorizationToken;
    }

    /**
     * 判断是否已经存在手工设置的授权 token。
     */
    public function hasUserAuthorizationToken(): bool
    {
        return $this->userAuthorizationToken !== null;
    }

    /**
     * 设置授权 token，并移除尚未执行的授权回调。
     */
    public function setUserAuthorizationToken(?string $userAuthorizationToken): void
    {
        $this->userAuthorizationToken = $userAuthorizationToken;
        if ($userAuthorizationToken !== null) {
            $this->removeLazyFunction(self::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION);
        }
    }

    public function addLazyFunction(string $key, callable $function): void
    {
        $this->lazyFunctions[$key] = $function;
    }

    /**
     * 执行指定的延迟函数，并保证同一个函数只执行一次。
     */
    protected function runLazyFunction(string $key): mixed
    {
        if (! isset($this->lazyFunctions[$key])) {
            return null;
        }

        $lazyFunction = $this->lazyFunctions[$key];
        unset($this->lazyFunctions[$key]);
        return $lazyFunction();
    }

    /** 身份变化时丢弃旧用户的授权、订阅和第三方派生能力。 */
    protected function resetIdentityCapabilities(): void
    {
        ++$this->initializationVersion;
        $this->userAuthorizationToken = null;
        $this->magicId = '';
        $this->thirdPlatformUserId = '';
        $this->thirdPlatformOrganizationCode = '';
        foreach ([self::USER_AUTHORIZATION_TOKEN_LAZY_FUNCTION, 'initSubscription', 'initOrganizationInfo'] as $key) {
            $this->removeLazyFunction($key);
        }
        $this->subscriptionManager = \Hyperf\Support\make(SubscriptionManagerInterface::class);
        $this->thirdPlatformDataIsolationManager = \Hyperf\Support\make(ThirdPlatformDataIsolationManagerInterface::class);
    }

    /**
     * 移除尚未执行的延迟函数。
     */
    protected function removeLazyFunction(string $key): void
    {
        unset($this->lazyFunctions[$key]);
    }
}

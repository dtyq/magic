<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\AiAbilityQuery;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Locker\LockerInterface;
use Exception;
use Hyperf\Contract\ConfigInterface;

/**
 * AI 能力领域服务.
 */
class AiAbilityDomainService
{
    private const int INITIALIZE_LOCK_EXPIRE_SECONDS = 60;

    private const int INITIALIZE_LOCK_WAIT_SECONDS = 60;

    public function __construct(
        private AiAbilityRepositoryInterface $aiAbilityRepository,
        private ConfigInterface $config,
        private LockerInterface $locker,
    ) {
    }

    /**
     * 根据能力代码获取AI能力实体（用于运行时，不校验组织）.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param AiAbilityCode $code 能力代码
     * @return AiAbilityEntity AI能力实体
     */
    public function getByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code): ?AiAbilityEntity
    {
        return $this->aiAbilityRepository->getByCode($dataIsolation, $code);
    }

    /**
     * 获取所有AI能力列表（无分页）.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @return array<AiAbilityEntity> AI能力实体列表
     */
    public function getAll(ProviderDataIsolation $dataIsolation): array
    {
        $query = new AiAbilityQuery();
        $page = Page::createNoPage();
        $result = $this->aiAbilityRepository->queries($dataIsolation, $query, $page);
        return $result['list'];
    }

    /**
     * 分页查询AI能力列表.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param AiAbilityQuery $query 查询条件
     * @param Page $page 分页信息
     * @return array{total: int, list: array<AiAbilityEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, AiAbilityQuery $query, Page $page): array
    {
        return $this->aiAbilityRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * 更新AI能力.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param AiAbilityCode $code 能力代码
     * @param array $data 更新数据
     * @return bool 是否更新成功
     * @throws Exception 当能力不存在时抛出异常
     */
    public function updateByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code, array $data): bool
    {
        // 检查能力是否存在
        $entity = $this->aiAbilityRepository->getByCode($dataIsolation, $code);
        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        if (empty($data)) {
            return true;
        }

        return $this->aiAbilityRepository->updateByCode($dataIsolation, $code, $data);
    }

    /**
     * 初始化AI能力数据.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param null|array $abilities AI 能力初始化配置
     * @return int 初始化的数量
     */
    public function initializeAbilities(ProviderDataIsolation $dataIsolation, ?array $abilities = null): int
    {
        $lockName = $this->buildInitializeLockName($dataIsolation);
        $lockOwner = uniqid('ai_abilities_init_', true);
        if (! $this->locker->spinLock(
            $lockName,
            $lockOwner,
            self::INITIALIZE_LOCK_EXPIRE_SECONDS,
            self::INITIALIZE_LOCK_WAIT_SECONDS
        )) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelOperationLocked);
        }

        try {
            return $this->initializeAbilitiesWithLock($dataIsolation, $abilities);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 获取指定能力的完整配置.
     *
     * @param AiAbilityCode $abilityCode 能力代码
     * @return array 配置数组
     */
    public function getProviderConfig(AiAbilityCode $abilityCode): array
    {
        $dataIsolation = ProviderDataIsolation::create('');
        $entity = $this->getByCode($dataIsolation, $abilityCode);
        // 能力尚未初始化（首启未跑 ai-abilities:init）时视为未配置，交给调用方降级处理。
        if ($entity === null || ! $entity->isEnabled()) {
            return [];
        }
        return $entity->getConfig();
    }

    /**
     * 在初始化锁保护下写入缺失的AI能力数据.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param null|array $abilities AI 能力初始化配置
     * @return int 初始化的数量
     */
    private function initializeAbilitiesWithLock(ProviderDataIsolation $dataIsolation, ?array $abilities = null): int
    {
        if ($abilities === null) {
            $configuredAbilities = $this->config->get('ai_abilities.abilities', []);
            $abilities = is_array($configuredAbilities) ? $configuredAbilities : [];
        }

        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $abilityItems = [];
        $codes = [];

        foreach ($abilities as $abilityConfig) {
            if (! is_array($abilityConfig)) {
                continue;
            }

            $code = AiAbilityCode::from($abilityConfig['code']);
            $abilityItems[] = [
                'code' => $code,
                'config' => $abilityConfig,
            ];
            $codes[] = $code;
        }

        $existingCodeMap = array_fill_keys(
            $this->aiAbilityRepository->getExistingCodes($dataIsolation, $codes),
            true
        );
        $count = 0;

        foreach ($abilityItems as $abilityItem) {
            /** @var AiAbilityCode $code */
            $code = $abilityItem['code'];
            $abilityConfig = $abilityItem['config'];
            if (isset($existingCodeMap[$code->value])) {
                continue;
            }

            // 构建名称和描述（确保是多语言格式）
            $name = $abilityConfig['name'];
            if (is_string($name)) {
                $name = [
                    'zh_CN' => $name,
                    'en_US' => $name,
                ];
            }

            $description = $abilityConfig['description'];
            if (is_string($description)) {
                $description = [
                    'zh_CN' => $description,
                    'en_US' => $description,
                ];
            }

            // 不存在则创建
            $entity = new AiAbilityEntity();
            $entity->setCode($abilityConfig['code']);
            $entity->setOrganizationCode($organizationCode);
            $entity->setName($name);
            $entity->setDescription($description);
            $entity->setIcon($abilityConfig['icon'] ?? '');
            $entity->setSortOrder($abilityConfig['sort_order'] ?? 0);
            $entity->setStatus($abilityConfig['status'] ?? true);
            $entity->setConfig($abilityConfig['config'] ?? []);

            $this->aiAbilityRepository->save($entity);
            $existingCodeMap[$code->value] = true;
            ++$count;
        }

        return $count;
    }

    /**
     * 构建AI能力初始化锁名称.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @return string 锁名称
     */
    private function buildInitializeLockName(ProviderDataIsolation $dataIsolation): string
    {
        return sprintf('ai_abilities_initialize_%s', $dataIsolation->getCurrentOrganizationCode());
    }
}

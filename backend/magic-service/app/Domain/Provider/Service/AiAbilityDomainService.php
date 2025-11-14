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
use Exception;
use Hyperf\Contract\ConfigInterface;

/**
 * AI 能力领域服务.
 */
class AiAbilityDomainService
{
    public function __construct(
        private AiAbilityRepositoryInterface $aiAbilityRepository,
        private ConfigInterface $config,
    ) {
    }

    /**
     * 根据能力代码获取AI能力实体（用于运行时，不校验组织）.
     *
     * @param ProviderDataIsolation $dataIsolation 数据隔离信息
     * @param AiAbilityCode $code 能力代码
     * @return AiAbilityEntity AI能力实体
     * @throws Exception 当能力不存在或未启用时抛出异常
     */
    public function getByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code): AiAbilityEntity
    {
        $entity = $this->aiAbilityRepository->getByCode($dataIsolation, $code);

        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        return $entity;
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
     * @return int 初始化的数量
     */
    public function initializeAbilities(ProviderDataIsolation $dataIsolation): int
    {
        $abilities = $this->config->get('ai_abilities.abilities', []);
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();
        $count = 0;

        foreach ($abilities as $abilityConfig) {
            // 检查数据库中是否已存在
            $code = AiAbilityCode::from($abilityConfig['code']);
            $existingEntity = $this->aiAbilityRepository->getByCode($dataIsolation, $code);

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

            if ($existingEntity === null) {
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
                ++$count;
            }
        }

        return $count;
    }
}

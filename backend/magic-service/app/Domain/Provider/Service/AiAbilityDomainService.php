<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\AccessPointUtil;
use Exception;

/**
 * AI 能力领域服务.
 */
readonly class AiAbilityDomainService
{
    public function __construct(
        private AiAbilityRepositoryInterface $aiAbilityRepository,
    ) {
    }

    /**
     * 根据能力代码获取AI能力实体.
     *
     * @param AiAbilityCode $code 能力代码
     * @return AiAbilityEntity AI能力实体
     * @throws Exception 当能力不存在或未启用时抛出异常
     */
    public function getByCode(AiAbilityCode $code): AiAbilityEntity
    {
        $entity = $this->aiAbilityRepository->getByCode($code);

        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        if (! $entity->isEnabled()) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_DISABLED);
        }

        // 应用默认值
        $this->applyDefaults($entity);

        return $entity;
    }

    /**
     * 应用默认配置.
     */
    private function applyDefaults(AiAbilityEntity $entity): void
    {
        $config = $entity->getConfig();
        $configArray = $config->toArray();

        // 如果没有设置接入点，使用默认接入点
        if (! $config->hasAccessPoint()) {
            $configArray['access_point'] = $this->getDefaultAccessPoint();
        }

        // 如果没有设置 API Key，使用默认 API Key
        if (! $config->hasApiKey()) {
            $configArray['api_key'] = $this->getDefaultApiKey();
        }

        if (! empty($configArray['access_point'])) {
            $configArray['url'] = AccessPointUtil::getAccessPointUrl($configArray['access_point']);
        }

        // 重新设置配置
        $entity->setConfig($configArray);
    }

    /**
     * 获取默认接入点.
     */
    private function getDefaultAccessPoint(): string
    {
        return config('ai_abilities.default_access_point');
    }

    /**
     * 获取默认 API Key.
     */
    private function getDefaultApiKey(): string
    {
        return config('ai_abilities.default_api_key');
    }
}

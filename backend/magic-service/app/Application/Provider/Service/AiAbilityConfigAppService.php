<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use InvalidArgumentException;
use RuntimeException;

readonly class AiAbilityConfigAppService
{
    /**
     * @var array<int, AiAbilityCode>
     */
    private const array AVAILABILITY_CODES = [
        AiAbilityCode::ImageConvertHigh,
        AiAbilityCode::ImageRemoveBackground,
        AiAbilityCode::ImageEraser,
        AiAbilityCode::ImageExpand,
        AiAbilityCode::VolcengineArkAssets,
    ];

    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
        private ProviderModelDomainService $providerModelDomainService,
    ) {
    }

    /**
     * @return array{enabled: bool, code: string, organization_code: string, config: array}
     */
    public function getConfig(string $organizationCode, string $abilityCode): array
    {
        $code = AiAbilityCode::tryFrom(trim($abilityCode));
        if ($code === null || $code === AiAbilityCode::Unknown) {
            throw new InvalidArgumentException('invalid ability_code');
        }

        $entity = $this->getOfficialAbilityEntity($code);
        if ($entity === null) {
            throw new RuntimeException('ai ability is not initialized');
        }

        return [
            'enabled' => $entity->isEnabled(),
            'code' => $entity->getCode()->value,
            'organization_code' => $entity->getOrganizationCode(),
            'config' => $entity->getConfig(),
        ];
    }

    /**
     * 获取前端使用的 AI 能力可用性配置.
     *
     * @return array{abilities: array{image_convert_high: array{enabled: bool, image_size_config: array{sizes: array<int, array<string, mixed>>}}, image_remove_background: array{enabled: bool}, image_eraser: array{enabled: bool}, image_expand: array{enabled: bool}, volcengine_ark_assets: array{enabled: bool}}}
     */
    public function getAvailability(ProviderDataIsolation $dataIsolation): array
    {
        $abilityMap = [];
        $dataIsolation->disabled();
        foreach ($this->aiAbilityDomainService->getAll($dataIsolation) as $entity) {
            if (! $entity instanceof AiAbilityEntity) {
                continue;
            }

            $abilityMap[$entity->getCode()->value] = $entity;
        }

        $abilities = [];
        foreach (self::AVAILABILITY_CODES as $code) {
            $entity = $abilityMap[$code->value] ?? null;
            $abilities[$code->value] = [
                'enabled' => $entity?->isEnabled() ?? false,
            ];

            if ($code === AiAbilityCode::ImageConvertHigh) {
                $abilities[$code->value]['image_size_config'] = $this->getImageSizeConfig($dataIsolation, $entity);
            }
        }

        return ['abilities' => $abilities];
    }

    /**
     * 获取图片转高清尺寸配置.
     *
     * @return array{sizes: array<int, array<string, mixed>>}
     */
    private function getImageSizeConfig(ProviderDataIsolation $dataIsolation, ?AiAbilityEntity $entity): array
    {
        $config = $entity?->getConfig() ?? [];
        $modelId = $config['model_id'] ?? null;
        if ($entity === null || ! $entity->isEnabled() || empty($modelId)) {
            return ['sizes' => []];
        }

        $modelEntity = $this->providerModelDomainService->getByModelId($dataIsolation, (string) $modelId);
        if ($modelEntity === null) {
            return ['sizes' => []];
        }

        return [
            'sizes' => SizeManager::getMaxScaleSizes($modelEntity->getModelVersion(), (string) $modelId),
        ];
    }

    private function getOfficialAbilityEntity(AiAbilityCode $code): ?AiAbilityEntity
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($officialOrganizationCode === '') {
            throw new RuntimeException('official organization code is empty');
        }

        $officialDataIsolation = ProviderDataIsolation::create($officialOrganizationCode);
        $officialDataIsolation->setOnlyOfficialOrganization(true);
        return $this->aiAbilityDomainService->getByCode($officialDataIsolation, $code);
    }
}

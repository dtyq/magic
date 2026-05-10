<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Logger\LoggerFactory;
use Throwable;

class VideoModelConfigResolver
{
    /**
     * @return null|array<string, mixed>
     */
    public function resolve(?array $videoModel, ?DataIsolation $dataIsolation = null): ?array
    {
        if ($videoModel === null) {
            return null;
        }

        $modelId = $this->extractVideoModelId($videoModel);
        if ($modelId === '') {
            return $videoModel;
        }

        if (is_array($videoModel['video_generation_config'] ?? null)) {
            $videoModel['model_id'] = $modelId;
            return $videoModel;
        }

        $videoGenerationConfig = $this->findVideoGenerationConfig($modelId, $dataIsolation);
        if ($videoGenerationConfig === null) {
            $videoModel['model_id'] = $modelId;
            return $videoModel;
        }

        return [
            'model_id' => $modelId,
            'video_generation_config' => $videoGenerationConfig,
        ];
    }

    /**
     * @return null|array<string, mixed>
     */
    public function findVideoGenerationConfig(string $modelId, ?DataIsolation $dataIsolation = null): ?array
    {
        $organizationConfig = $this->findOrganizationVideoGenerationConfig($modelId, $dataIsolation);
        if ($organizationConfig !== null) {
            return $organizationConfig;
        }

        try {
            $candidates = $this->buildVideoGenerationConfigCandidates($modelId);
            if ($candidates === []) {
                return null;
            }

            $videoGenerationConfigDomainService = di(VideoGenerationConfigDomainService::class);
            $featuredConfigs = $videoGenerationConfigDomainService->resolveFeatured($candidates);
            return $featuredConfigs[$modelId]?->toArray() ?? null;
        } catch (Throwable $throwable) {
            di(LoggerFactory::class)->get(static::class)->warning('Failed to resolve video generation config, fallback to model_id only', [
                'model_id' => $modelId,
                'error' => $throwable->getMessage(),
                'exception' => $throwable::class,
            ]);
            return null;
        }
    }

    /**
     * @return null|array<string, mixed>
     */
    private function findOrganizationVideoGenerationConfig(string $modelId, ?DataIsolation $dataIsolation): ?array
    {
        if ($dataIsolation === null || $dataIsolation->getCurrentOrganizationCode() === '') {
            return null;
        }

        try {
            $modelGatewayMapper = di(ModelGatewayMapper::class);
            $modelEntry = $modelGatewayMapper->getOrganizationVideoModel(
                $this->createModelGatewayDataIsolation($dataIsolation),
                $modelId
            );
            $videoModel = $modelEntry?->getVideoModel();
            if ($modelEntry === null || $videoModel === null) {
                return null;
            }

            $videoGenerationConfigDomainService = di(VideoGenerationConfigDomainService::class);
            $videoGenerationConfig = $videoGenerationConfigDomainService->resolve(
                $videoModel->getModelVersion(),
                $modelEntry->getAttributes()->getKey(),
                $videoModel->getProviderCode(),
            );

            return $videoGenerationConfig?->toArray();
        } catch (Throwable $throwable) {
            di(LoggerFactory::class)->get(static::class)->warning('Failed to resolve organization video generation config, fallback to featured config', [
                'model_id' => $modelId,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $throwable->getMessage(),
                'exception' => $throwable::class,
            ]);
            return null;
        }
    }

    /**
     * @return list<VideoGenerationConfigCandidate>
     */
    private function buildVideoGenerationConfigCandidates(string $modelId): array
    {
        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $providerModelDomainService = di(ProviderModelDomainService::class);
        $groupedModels = $providerModelDomainService->getModelsByModelIds($providerDataIsolation, [$modelId]);
        $providerModels = $groupedModels[$modelId] ?? [];
        if ($providerModels === []) {
            return [];
        }

        $providerConfigIds = array_values(array_unique(array_map(
            static fn (ProviderModelEntity $model): int => $model->getServiceProviderConfigId(),
            $providerModels
        )));
        $providerConfigDomainService = di(ProviderConfigDomainService::class);
        $providerConfigs = $providerConfigDomainService->getByIds($providerDataIsolation, $providerConfigIds);

        $candidates = [];
        foreach ($providerModels as $providerModel) {
            $providerConfig = $providerConfigs[$providerModel->getServiceProviderConfigId()] ?? null;
            if (! $this->isProviderModelAvailable($providerModel, $providerConfig)) {
                continue;
            }
            $providerCode = $providerConfig?->getProviderCode();
            if (! $providerCode instanceof ProviderCode) {
                continue;
            }
            $candidates[] = new VideoGenerationConfigCandidate(
                modelId: $providerModel->getModelId(),
                modelVersion: $providerModel->getModelVersion(),
                providerCode: $providerCode,
            );
        }

        return $candidates;
    }

    private function isProviderModelAvailable(ProviderModelEntity $providerModel, ?ProviderConfigEntity $providerConfig): bool
    {
        if ($providerModel->getStatus() !== Status::Enabled) {
            return false;
        }

        if ($providerModel->isDynamicModel()) {
            return true;
        }

        return $providerConfig?->getStatus() === Status::Enabled;
    }

    private function createModelGatewayDataIsolation(DataIsolation $dataIsolation): ModelGatewayDataIsolation
    {
        return new ModelGatewayDataIsolation(
            $dataIsolation->getCurrentOrganizationCode(),
            (string) $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentMagicId()
        );
    }

    /**
     * @param array<string, mixed> $videoModel
     */
    private function extractVideoModelId(array $videoModel): string
    {
        $modelId = $videoModel['model_id'] ?? null;
        return is_string($modelId) ? trim($modelId) : '';
    }
}

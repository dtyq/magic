<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ModelGateway;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Repository\QueueExecutorConfigRepositoryInterface;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Domain\VideoCatalog\Service\VideoCatalogQueryDomainService;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use RuntimeException;

class QueueExecutorConfigRepository implements QueueExecutorConfigRepositoryInterface
{
    public function getConfig(string $modelId, string $organizationCode): QueueExecutorConfig
    {
        $providerModel = $this->getProviderModel($modelId, $organizationCode);
        if ($providerModel->status !== Status::Enabled->value) {
            throw new RuntimeException('provider model disabled');
        }

        $serviceProviderConfigId = $this->resolveServiceProviderConfigId($providerModel);
        $providerConfig = ProviderConfigModel::query()->where('id', $serviceProviderConfigId)->first();
        if (! $providerConfig instanceof ProviderConfigModel) {
            throw new RuntimeException('video service provider config missing');
        }
        if ((int) $providerConfig->status !== Status::Enabled->value && ! $this->isOfficialModel($providerModel)) {
            throw new RuntimeException('provider config disabled');
        }

        $config = is_array($providerConfig->config) ? $providerConfig->config : [];
        $baseUrl = $this->resolveStringConfig($config, ['url', 'base_url']);
        $apiKey = $this->resolveStringConfig($config, ['api_key', 'apiKey']);
        if ($baseUrl === '' || $apiKey === '') {
            throw new RuntimeException('video service provider config missing');
        }

        return new QueueExecutorConfig(
            baseUrl: $baseUrl,
            apiKey: $apiKey,
            pollIntervalSeconds: max(1, (int) config('model_gateway.video_queue.poll_interval_seconds', 3)),
            maxPollTimes: max(20, (int) config('model_gateway.video_queue.poll_max_times', 200)),
            extraConfig: $config,
        );
    }

    private function getProviderModel(string $modelId, string $organizationCode): ProviderModelModel
    {
        $organizationCodes = OfficialOrganizationUtil::getOrganizationCodesWithOfficial($organizationCode);
        $query = ProviderModelModel::query()->whereIn('organization_code', $organizationCodes);
        if (is_numeric($modelId)) {
            $query->where('id', (int) $modelId);
        } else {
            $query->whereIn('model_id', array_unique([
                $modelId,
                VideoCatalogQueryDomainService::canonicalModelId($modelId),
            ]));
        }

        /** @var array<int, ProviderModelModel> $models */
        $models = $query->get()->all();
        if ($models === []) {
            throw new RuntimeException('provider model not found');
        }

        usort($models, static function (ProviderModelModel $left, ProviderModelModel $right) use ($organizationCode): int {
            $leftRank = $left->organization_code === $organizationCode ? 0 : 1;
            $rightRank = $right->organization_code === $organizationCode ? 0 : 1;
            if ($leftRank !== $rightRank) {
                return $leftRank <=> $rightRank;
            }
            return $right->id <=> $left->id;
        });

        return $models[0];
    }

    private function resolveServiceProviderConfigId(ProviderModelModel $providerModel): int
    {
        if ($providerModel->model_parent_id > 0 && $this->isOfficialModel($providerModel)) {
            $parentModel = ProviderModelModel::query()->where('id', $providerModel->model_parent_id)->first();
            if ($parentModel instanceof ProviderModelModel) {
                return (int) $parentModel->service_provider_config_id;
            }
        }

        return $providerModel->service_provider_config_id;
    }

    private function resolveStringConfig(array $config, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $config[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return '';
    }

    private function isOfficialModel(ProviderModelModel $providerModel): bool
    {
        return $providerModel->is_office === 1;
    }
}

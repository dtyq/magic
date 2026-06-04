<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use Hyperf\Odin\Model\AbstractModel;
use InvalidArgumentException;
use RuntimeException;

readonly class ModelCallConfigAppService
{
    public function __construct(
        private ModelGatewayMapper $modelGatewayMapper,
    ) {
    }

    /**
     * @return array{model_id: string, model: string, provider_code: string, request_base_url: string, access_token: string, raw_config: array}
     */
    public function getConfig(string $organizationCode, string $modelId, string $modelType = 'llm'): array
    {
        $modelId = trim($modelId);
        $modelType = strtolower(trim($modelType));
        if ($modelId === '') {
            throw new InvalidArgumentException('model_id is empty');
        }

        $entry = $this->getModelEntry($this->getOfficialOrganizationCode(), $modelId, $modelType);
        $model = $entry instanceof ModelEntry ? $entry->getOdinModel()?->getModel() : $entry;
        if (! $model instanceof AbstractModel) {
            throw new RuntimeException('model is not an OpenAI compatible model');
        }

        $modelConfig = $model->getConfig();
        $accessToken = trim((string) ($modelConfig['api_key'] ?? ''));
        $baseURL = trim((string) ($modelConfig['base_url'] ?? $modelConfig['api_base'] ?? ''));
        $realModel = trim((string) $model->getModelName());
        $providerCode = $entry instanceof ModelEntry ? trim($entry->getAttributes()->getProviderCode()) : '';

        if ($realModel === '') {
            throw new RuntimeException('resolved model is empty');
        }
        if ($baseURL === '') {
            throw new RuntimeException('model request base url is empty');
        }

        return [
            'model_id' => $modelId,
            'model' => $realModel,
            'provider_code' => $providerCode,
            'request_base_url' => $baseURL,
            'access_token' => $accessToken,
            'raw_config' => $modelConfig,
        ];
    }

    private function getOfficialOrganizationCode(): string
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($officialOrganizationCode === '') {
            throw new RuntimeException('official organization code is empty');
        }

        return $officialOrganizationCode;
    }

    private function getModelEntry(string $organizationCode, string $modelId, string $modelType): mixed
    {
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        return match ($modelType) {
            'llm', 'chat', (string) ModelType::LLM->value => $this->modelGatewayMapper->getOrganizationChatModel($dataIsolation, $modelId),
            'embedding', (string) ModelType::EMBEDDING->value => $this->modelGatewayMapper->getOrganizationEmbeddingModel($dataIsolation, $modelId),
            default => throw new InvalidArgumentException('unsupported model_type'),
        };
    }
}

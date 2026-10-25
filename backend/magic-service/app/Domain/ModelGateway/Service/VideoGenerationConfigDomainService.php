<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

/**
 * 视频统一参数配置领域服务。
 *
 * 这是视频能力单一来源的核心入口，负责两件事：
 *
 * 1. 单 provider/model 能力解析
 *    从 adapter 读取当前系统真实支持的 VideoGenerationConfig。
 *
 * 2. featured 能力的 provider 择一
 *    同一个逻辑 model_id 下可能挂多条 provider_model，但运行时只会命中其中一条，
 *    因此对外展示时取同一条，保证展示与执行使用同一份能力配置。
 *
 * 这里不负责 provider 模型查询与组织过滤，这些由 app 层完成。
 */
readonly class VideoGenerationConfigDomainService
{
    public function __construct(
        private VideoGenerationProviderAdapterFactoryInterface $adapterFactory,
        private ?LoggerInterface $logger = null,
    ) {
    }

    public function resolve(string $modelVersion, string $modelId, ProviderCode $providerCode): ?VideoGenerationConfig
    {
        $adapter = $this->resolveAdapter($modelVersion, $modelId, $providerCode);
        if ($adapter === null) {
            return null;
        }

        return $adapter->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function resolveHasAudioOutput(
        string $modelVersion,
        string $modelId,
        ProviderCode $providerCode,
        array $request
    ): bool {
        $adapter = $this->resolveAdapter($modelVersion, $modelId, $providerCode);
        if ($adapter === null) {
            return true;
        }

        return $adapter->resolveHasAudioOutput($modelVersion, $modelId, $request);
    }

    /**
     * featured 对外按逻辑 model_id 下发的能力配置。
     *
     * 同一个逻辑 model_id 下可能存在多条 provider_model（主备或不同服务商），
     * 但运行时始终按固定优先级只命中其中一条：
     * ProviderModelRepository::getAvailableByModelIdOrId 中
     * `sort desc → service_provider_config_id desc → id asc` 取首条，
     * 且当前视频链路不存在跨 provider 的故障转移或负载均衡。
     *
     * 因此这里直接采用候选中优先级最高且可解析的一条，
     * 让「前端展示的能力」等于「实际执行使用的那条 provider 的能力」。
     * 若这里改成对多个 provider 求交集，只要备选 provider 能力更弱，
     * 就会把实际永远不会用到的更严格限制下发到前端。
     *
     * 注意：候选项必须已按上述运行时优先级排序，该排序由 app 层负责，
     * 否则取到的 provider 会与运行时不一致。
     *
     * @param list<VideoGenerationConfigCandidate> $candidates
     * @return array<string, VideoGenerationConfig>
     */
    public function resolveFeatured(array $candidates): array
    {
        // featured 对外按逻辑 model_id 返回，因此先按 model_id 分组。
        $groupedCandidates = [];
        foreach ($candidates as $candidate) {
            $groupedCandidates[$candidate->getModelId()][] = $candidate;
        }

        $resolvedConfigs = [];
        foreach ($groupedCandidates as $modelId => $modelCandidates) {
            foreach ($modelCandidates as $candidate) {
                $config = $this->resolve(
                    $candidate->getModelVersion(),
                    $candidate->getModelId(),
                    $candidate->getProviderCode(),
                );
                if ($config instanceof VideoGenerationConfig) {
                    // 取优先级最高且可解析的一条，与运行时选中的 provider 保持一致。
                    $resolvedConfigs[$modelId] = $config;
                    break;
                }
            }
        }

        return $resolvedConfigs;
    }

    private function resolveAdapter(
        string $modelVersion,
        string $modelId,
        ProviderCode $providerCode
    ): ?VideoGenerationProviderAdapterInterface {
        try {
            $adapter = $this->adapterFactory->createByProviderCode($providerCode, $modelVersion);
        } catch (InvalidArgumentException $exception) {
            $this->logger?->warning('video generation adapter resolve failed', [
                'provider_code' => $providerCode->value,
                'model_version' => $modelVersion,
                'model_id' => $modelId,
                'error' => $exception->getMessage(),
            ]);
            // 未接入该 provider 时，视为当前没有可用能力配置。
            return null;
        }

        if (! $adapter->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return $adapter;
    }
}

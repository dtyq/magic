<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Psr\Log\LoggerInterface;
use Throwable;

class KnowledgeBaseEmbeddingModelAbilityAppService extends AbstractKernelAppService
{
    private const string LOCK_KEY = 'ai_ability:knowledge_base_embedding_model:update';

    private const int LOCK_TTL = 300;

    private const int MAX_REBUILD_ATTEMPTS = 3;

    private const string PROBE_TEXT = '知识库嵌入模型维度探测';

    public function __construct(
        private readonly AiAbilityDomainService $aiAbilityDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly KnowledgeBaseDomainService $knowledgeBaseDomainService,
        private readonly KnowledgeBaseGateway $knowledgeBaseGateway,
        private readonly LLMAppService $llmAppService,
        private readonly LockerInterface $locker,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function enrichDetail(AiAbilityDetailDTO $detailDTO): AiAbilityDetailDTO
    {
        if ($detailDTO->code !== AiAbilityCode::KnowledgeBaseEmbeddingModel->value) {
            return $detailDTO;
        }

        $currentEffectiveModelId = $this->knowledgeBaseDomainService->getCurrentEmbeddingModelId();
        $currentModelIds = $this->knowledgeBaseDomainService->getAllEmbeddingModelIds();
        $detailDTO->config['current_embedding_models'] = $currentModelIds;
        $detailDTO->config['model_id'] = $this->resolveDetailModelId($detailDTO->config, $currentModelIds, $currentEffectiveModelId);

        return $detailDTO;
    }

    public function update(MagicUserAuthorization $authorization, UpdateAiAbilityRequest $request): bool
    {
        $dataIsolation = $this->createProviderDataIsolation($authorization);
        $entity = $this->aiAbilityDomainService->getByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel);
        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        $updateData = [];
        if ($request->hasStatus()) {
            $updateData['status'] = $request->getStatus();
        }
        if ($request->hasConfig()) {
            $requestConfig = $request->getConfig();
            $oldConfig = $entity->getConfig();
            $mergedConfig = $entity->mergeConfig($requestConfig);
            unset($mergedConfig['current_embedding_models']);
            $mergedConfig = $this->preserveRuntimeFields($requestConfig, $oldConfig, $mergedConfig);
            $newModelId = trim((string) ($mergedConfig['model_id'] ?? ''));
            $currentModelIds = $this->knowledgeBaseDomainService->getAllEmbeddingModelIds();
            $currentEffectiveModelId = $this->knowledgeBaseDomainService->getCurrentEmbeddingModelId();

            if ($this->shouldTriggerRebuildForModel($requestConfig, $currentModelIds, $currentEffectiveModelId, $oldConfig, $newModelId)) {
                $mergedConfig = $this->prepareChangedModelConfig($authorization, $dataIsolation, $oldConfig, $mergedConfig, $newModelId);
            }
            $updateData['config'] = $mergedConfig;
        }

        if ($updateData === []) {
            return true;
        }

        return $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, $updateData);
    }

    /**
     * @return array<string, mixed>
     */
    public function reconcilePendingRebuilds(): array
    {
        $owner = $this->lockOwner();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_TTL)) {
            return ['status' => 'locked'];
        }

        try {
            $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
            if ($officialOrganizationCode === '') {
                return ['status' => 'skipped', 'reason' => 'official organization code is empty'];
            }

            $dataIsolation = ProviderDataIsolation::create($officialOrganizationCode);
            $entity = $this->aiAbilityDomainService->getByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel);
            if ($entity === null) {
                return ['status' => 'skipped', 'reason' => 'ability not initialized'];
            }

            $config = $entity->getConfig();
            $pendingModelId = trim((string) ($config['pending_model_id'] ?? ''));
            $targetDimension = (int) ($config['target_dimension'] ?? 0);
            if ($pendingModelId === '' || $targetDimension <= 0) {
                return ['status' => 'idle'];
            }

            $status = $this->rebuildStatus($this->officialKnowledgeDataIsolation(), (string) ($config['rebuild_run_id'] ?? ''));
            if (($status['current_run_id'] ?? '') !== '') {
                return ['status' => 'running', 'run_id' => $status['current_run_id']];
            }

            $jobStatus = (string) ($status['status'] ?? '');
            if ($jobStatus === 'completed') {
                $this->clearPendingState($dataIsolation, $config);
                return ['status' => 'completed', 'run_id' => $status['run_id'] ?? ''];
            }

            $attempts = (int) ($config['attempts'] ?? 1);
            if ($attempts >= self::MAX_REBUILD_ATTEMPTS) {
                $config['rebuild_status'] = 'failed';
                $config['last_error'] = (string) ($status['error'] ?? ($config['last_error'] ?? ''));
                $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, ['config' => $config]);
                return ['status' => 'failed', 'attempts' => $attempts, 'last_error' => $config['last_error'] ?? ''];
            }

            $response = $this->triggerRebuild($this->officialKnowledgeDataIsolation(), $pendingModelId, $targetDimension);
            if (($response['status'] ?? '') === 'already_running') {
                $config['rebuild_status'] = 'waiting';
                $config['last_error'] = sprintf('知识库重建正在运行中，run_id=%s', (string) ($response['run_id'] ?? ''));
                unset($config['rebuild_run_id']);
                $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, ['config' => $config]);
                return ['status' => 'running', 'run_id' => $response['run_id'] ?? ''];
            }

            $config['rebuild_run_id'] = (string) ($response['run_id'] ?? '');
            $config['rebuild_status'] = (string) ($response['status'] ?? 'running');
            $config['attempts'] = $attempts + 1;
            $config['last_error'] = '';
            $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, ['config' => $config]);

            return ['status' => 'retried', 'run_id' => $config['rebuild_run_id'], 'attempts' => $config['attempts']];
        } catch (Throwable $throwable) {
            $this->logger->error('Knowledge base embedding model rebuild reconcile failed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
            return ['status' => 'error', 'message' => $throwable->getMessage()];
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }

    /**
     * @param array<string, mixed> $config
     * @param array<int, string> $currentModelIds
     */
    private function resolveDetailModelId(array $config, array $currentModelIds, string $currentEffectiveModelId): string
    {
        $configuredModelId = trim((string) ($config['model_id'] ?? ''));
        $appliedModelId = trim((string) ($config['applied_model_id'] ?? ''));
        if ($appliedModelId !== '') {
            return $configuredModelId !== '' ? $configuredModelId : $appliedModelId;
        }

        $currentEffectiveModelId = trim($currentEffectiveModelId);
        if ($currentEffectiveModelId !== '') {
            return $currentEffectiveModelId;
        }

        if (count($currentModelIds) === 1) {
            return $currentModelIds[0];
        }

        return '';
    }

    /**
     * @param array<string, mixed> $requestConfig
     * @param array<string, mixed> $oldConfig
     * @param array<string, mixed> $mergedConfig
     * @return array<string, mixed>
     */
    private function preserveRuntimeFields(array $requestConfig, array $oldConfig, array $mergedConfig): array
    {
        foreach ([
            'applied_model_id',
            'applied_dimension',
            'rebuild_run_id',
            'rebuild_status',
            'pending_model_id',
            'target_dimension',
            'attempts',
            'last_error',
            'switch_model_id',
            'switch_dimension',
            'switch_status',
            'switch_attempts',
            'switch_last_error',
        ] as $key) {
            if (array_key_exists($key, $requestConfig) || ! array_key_exists($key, $oldConfig)) {
                continue;
            }
            $mergedConfig[$key] = $oldConfig[$key];
        }

        return $mergedConfig;
    }

    /**
     * @param array<string, mixed> $oldConfig
     * @param array<string, mixed> $mergedConfig
     * @return array<string, mixed>
     */
    private function prepareChangedModelConfig(
        MagicUserAuthorization $authorization,
        ProviderDataIsolation $dataIsolation,
        array $oldConfig,
        array $mergedConfig,
        string $newModelId,
    ): array {
        $owner = $this->lockOwner();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_TTL)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '知识库嵌入模型正在切换中，请稍后重试');
        }

        try {
            $this->assertNoRunningRebuild($this->knowledgeDataIsolation($authorization));
            $this->assertEmbeddingModel($dataIsolation, $newModelId);
            $dimension = $this->probeEmbeddingDimension($authorization, $newModelId);

            // 先落 switch intent 状态，避免 Go 侧已切 meta 但后续写配置失败时补偿线索丢失。
            $triggeringConfig = $this->withSwitchState($oldConfig, $newModelId, $dimension, 'switching', 0, '');
            $this->persistAbilityConfig($dataIsolation, $triggeringConfig);

            try {
                $this->switchEmbeddingModelMeta($this->knowledgeDataIsolation($authorization), $newModelId, $dimension);
            } catch (Throwable $throwable) {
                $failedConfig = $this->withSwitchState($triggeringConfig, $newModelId, $dimension, 'failed', 0, $throwable->getMessage());
                $this->persistAbilityConfig($dataIsolation, $failedConfig);
                throw $throwable;
            }

            $appliedConfig = $this->withAppliedModelConfig($mergedConfig, $newModelId, $dimension);
            $this->persistAbilityConfig($dataIsolation, $appliedConfig);
            return $appliedConfig;
        } catch (Throwable $throwable) {
            if ($throwable instanceof BusinessException) {
                throw $throwable;
            }
            $this->logger->error('Knowledge base embedding model change failed', [
                'model_id' => $newModelId,
                'error' => $throwable->getMessage(),
            ]);
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '知识库嵌入模型切换失败：' . $throwable->getMessage(), throwable: $throwable);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }

    private function assertEmbeddingModel(ProviderDataIsolation $dataIsolation, string $modelId): void
    {
        $model = $this->providerModelDomainService->getAvailableByModelIdOrId($dataIsolation, $modelId);
        if ($model === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        if (! $model->getModelType()->isEmbedding() && ! ($model->getConfig()?->isSupportEmbedding() ?? false)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType, '请选择嵌入模型');
        }
    }

    private function probeEmbeddingDimension(MagicUserAuthorization $authorization, string $modelId): int
    {
        $request = new EmbeddingsDTO();
        $request->setModel($modelId);
        $request->setInput(self::PROBE_TEXT);
        $request->setEnableHighAvailability(false);
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $request->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $request->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'organization_code' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => SourceId::KNOWLEDGE_EMBEDDING_MODEL_DIMENSION_PROBE,
        ]);

        $response = $this->llmAppService->embeddings($request);
        $payload = method_exists($response, 'toArray') ? $response->toArray() : [];
        $embedding = $payload['data'][0]['embedding'] ?? null;
        if (! is_array($embedding)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '嵌入模型探测响应缺少向量');
        }

        $dimension = count($embedding);
        if ($dimension <= 0) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '嵌入模型探测维度为空');
        }

        return $dimension;
    }

    private function assertNoRunningRebuild(DataIsolationDTO $dataIsolation): void
    {
        $status = $this->rebuildStatus($dataIsolation);
        $currentRunID = (string) ($status['current_run_id'] ?? '');
        if ($currentRunID !== '') {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, sprintf('知识库重建正在运行中，run_id=%s', $currentRunID));
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function rebuildStatus(DataIsolationDTO $dataIsolation, string $runID = ''): array
    {
        $payload = [];
        if ($runID !== '') {
            $payload['run_id'] = $runID;
        }

        return $this->knowledgeBaseGateway->rebuildStatus(
            KnowledgeBaseRequestDTO::forRebuildStatus($payload, $dataIsolation)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function triggerRebuild(DataIsolationDTO $dataIsolation, string $modelId, int $dimension): array
    {
        return $this->knowledgeBaseGateway->rebuild(KnowledgeBaseRequestDTO::forRebuild([
            'scope' => 'all',
            'mode' => 'bluegreen',
            'target_model' => $modelId,
            'target_dimension' => $dimension,
            'retry' => 2,
        ], $dataIsolation));
    }

    /**
     * @return array<string, mixed>
     */
    private function switchEmbeddingModelMeta(DataIsolationDTO $dataIsolation, string $modelId, int $dimension): array
    {
        return $this->knowledgeBaseGateway->switchEmbeddingModelMeta(KnowledgeBaseRequestDTO::forSwitchEmbeddingModelMeta([
            'target_model' => $modelId,
            'target_dimension' => $dimension,
        ], $dataIsolation));
    }

    /**
     * @param array<string, mixed> $config
     */
    private function clearPendingState(ProviderDataIsolation $dataIsolation, array $config): void
    {
        $appliedModelId = trim((string) ($config['pending_model_id'] ?? $config['model_id'] ?? ''));
        $appliedDimension = (int) ($config['target_dimension'] ?? 0);
        $config = $this->clearPendingFields($config);
        if ($appliedModelId !== '') {
            $config['applied_model_id'] = $appliedModelId;
        }
        if ($appliedDimension > 0) {
            $config['applied_dimension'] = $appliedDimension;
        }
        $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, ['config' => $config]);
    }

    /**
     * @param array<string, mixed> $requestConfig
     * @param array<int, string> $currentModelIds
     * @param array<string, mixed> $oldConfig
     */
    private function shouldTriggerRebuildForModel(
        array $requestConfig,
        array $currentModelIds,
        string $currentEffectiveModelId,
        array $oldConfig,
        string $newModelId,
    ): bool {
        if (! array_key_exists('model_id', $requestConfig) || $newModelId === '') {
            return false;
        }

        $currentEffectiveModelId = trim($currentEffectiveModelId);
        if ($currentEffectiveModelId !== '') {
            return $currentEffectiveModelId !== $newModelId;
        }

        $appliedModelId = trim((string) ($oldConfig['applied_model_id'] ?? ''));
        if ($appliedModelId !== '' && $appliedModelId === $newModelId) {
            return false;
        }

        if (count($currentModelIds) === 0) {
            return true;
        }

        if (count($currentModelIds) === 1) {
            return $currentModelIds[0] !== $newModelId;
        }

        return true;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function clearPendingFields(array $config): array
    {
        foreach ([
            'rebuild_run_id',
            'rebuild_status',
            'pending_model_id',
            'target_dimension',
            'attempts',
            'last_error',
            'switch_model_id',
            'switch_dimension',
            'switch_status',
            'switch_attempts',
            'switch_last_error',
        ] as $key) {
            unset($config[$key]);
        }
        return $config;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function withAppliedModelConfig(array $config, string $modelId, int $dimension): array
    {
        $config = $this->clearPendingFields($config);
        $config['model_id'] = $modelId;
        $config['applied_model_id'] = $modelId;
        $config['applied_dimension'] = $dimension;
        return $config;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function withSwitchState(
        array $config,
        string $modelId,
        int $dimension,
        string $status,
        int $attempts,
        string $lastError,
    ): array {
        $config = $this->clearPendingFields($config);
        $config['switch_model_id'] = $modelId;
        $config['switch_dimension'] = $dimension;
        $config['switch_status'] = $status;
        $config['switch_attempts'] = $attempts;
        $config['switch_last_error'] = $lastError;
        return $config;
    }

    /**
     * @param array<string, mixed> $config
     */
    private function persistAbilityConfig(ProviderDataIsolation $dataIsolation, array $config): void
    {
        $this->aiAbilityDomainService->updateByCode($dataIsolation, AiAbilityCode::KnowledgeBaseEmbeddingModel, ['config' => $config]);
    }

    private function knowledgeDataIsolation(MagicUserAuthorization $authorization): DataIsolationDTO
    {
        return new DataIsolationDTO($authorization->getOrganizationCode(), $authorization->getId());
    }

    private function officialKnowledgeDataIsolation(): DataIsolationDTO
    {
        return new DataIsolationDTO(OfficialOrganizationUtil::getOfficialOrganizationCode(), '');
    }

    private function lockOwner(): string
    {
        return implode(':', array_filter([
            'knowledge-base-embedding-model',
            gethostname() ?: 'unknown-host',
            (string) getmypid(),
            bin2hex(random_bytes(4)),
        ]));
    }
}

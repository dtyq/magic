<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Component\Points\DTO\PointEstimateResult;
use App\Application\ModelGateway\Component\Points\DTO\VideoPointEstimateRequest;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\Video\VideoInputMediaMetadataResolver;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGenerateFailedEvent;
use App\Domain\ModelGateway\Service\QueueOperationExecutionDomainService;
use App\Domain\ModelGateway\Service\VideoBillingDetailsResolver;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use RuntimeException;
use Throwable;
use Throwable as BaseThrowable;

/**
 * 视频生成应用服务。
 *
 * 统一视频参数方案下，这里只做应用层编排：
 * - 根据组织和模型 ID 选出最终 provider 模型
 * - 从同一个 provider adapter 解析统一能力配置
 * - 把配置传给 domain service 完成规范化与校验
 */
readonly class VideoOperationAppService
{
    use HasLogger;

    private const string INTERNAL_PROBE_RESULT_KEY = '__video_media_probe_result';

    private const int PROBE_DOWNLOAD_MAX_BYTES = 104857600;

    private const int STREAM_BUFFER_BYTES = 8192;

    private const string AUDIT_STATUS_SUCCESS = 'SUCCESS';

    private const string AUDIT_STATUS_FAIL = 'FAIL';

    public function __construct(
        private LLMAppService $llmAppService,
        private VideoQueueDomainService $videoQueueDomainService,
        private QueueOperationExecutionDomainService $queueOperationExecutionDomainService,
        private PointComponentInterface $pointComponent,
        private ModelGatewayMapper $modelGatewayMapper,
        private VideoGenerationConfigDomainService $videoGenerationConfigDomainService,
        private FileDomainService $fileDomainService,
        private VideoBillingDetailsResolver $videoBillingDetailsResolver,
        private VideoMediaProbeInterface $videoMediaProbe,
        private VideoInputMediaMetadataResolver $videoInputMediaMetadataResolver,
    ) {
    }

    public function estimate(string $accessToken, CreateVideoDTO $requestDTO): PointEstimateResult
    {
        $dataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $requestDTO->getBusinessParams());
        $videoModelEntry = $this->modelGatewayMapper->getOrganizationVideoModel($dataIsolation, $requestDTO->getModel());
        $videoModel = $videoModelEntry?->getVideoModel();
        if ($videoModel === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }

        // 预估和真实提交使用同一份模型能力配置，防止费用展示和实际执行参数不一致。
        $videoGenerationConfig = $this->videoGenerationConfigDomainService->resolve(
            $videoModel->getModelVersion(),
            $requestDTO->getModel(),
            $videoModel->getProviderCode(),
        );
        if ($videoGenerationConfig === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'unsupported_option: model_id');
        }

        $estimateRequest = $this->buildVideoPointEstimateRequest(
            $dataIsolation,
            $requestDTO,
            $videoModel->getProviderCode(),
            $videoGenerationConfig,
        );
        $result = $this->pointComponent->estimateVideoPoints($estimateRequest, $dataIsolation);
        $this->logger->info('video point estimate calculated', [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'model_id' => $requestDTO->getModel(),
            'points' => $result->getPoints(),
            'detail' => $result->getDetail(),
        ]);

        return $result;
    }

    /**
     * 历史命名保留为 enqueue，但当前视频创建已不再进入本地 Redis 队列，
     * 而是完成参数校验后立即直提 provider。
     *
     * @throws Throwable
     */
    public function enqueue(string $accessToken, CreateVideoDTO $requestDTO): VideoOperationResponseDTO
    {
        $dataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $requestDTO->getBusinessParams());
        $this->pointComponent->checkPointsSufficient($requestDTO, $dataIsolation);
        $videoModelEntry = $this->modelGatewayMapper->getOrganizationVideoModel($dataIsolation, $requestDTO->getModel());
        $videoModel = $videoModelEntry?->getVideoModel();
        if ($videoModel === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }

        // 运行时校验与 featured 共用同一份能力来源，
        // 这样前端看到的配置和实际提交能力保持一致。
        $videoGenerationConfig = $this->videoGenerationConfigDomainService->resolve(
            $videoModel->getModelVersion(),
            $requestDTO->getModel(),
            $videoModel->getProviderCode(),
        );
        if ($videoGenerationConfig === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'unsupported_option: model_id');
        }

        $operation = $this->videoQueueDomainService->createOperation(
            $dataIsolation,
            $videoModel->getModelVersion(),
            $videoModel->getProviderModelId(),
            $videoModel->getProviderCode(),
            $requestDTO,
            $videoGenerationConfig,
        );
        $auditProviderName = (string) ($videoModelEntry?->getAttributes()->getProviderName() ?? '');
        $operation->setAuditProviderName($auditProviderName);

        // 获取个人并发数量限制
        $personalVideoGenerationConcurrencyLimit = $dataIsolation->getSubscriptionManager()->getPersonalVideoGenerationConcurrencyLimit();

        // 占用新槽位前先清理已结束或已失效的旧槽位，避免任务已结束仍占用并发名额。
        $this->videoQueueDomainService->cleanupActiveOperationsBeforeClaim($operation);

        // 先保存 operation hash，再写入并发槽位，避免并发清理把正在提交 provider 的任务误判为无效槽位。
        $this->videoQueueDomainService->saveOperation($operation);

        try {
            // 提交 provider 前先按套餐占用个人视频运行槽位
            $this->videoQueueDomainService->claimUserActiveOperation($operation, $personalVideoGenerationConcurrencyLimit);

            $config = $this->queueOperationExecutionDomainService->getConfig($operation);
            $providerTaskId = $this->queueOperationExecutionDomainService->submit($operation, $config);
        } catch (ProviderVideoException $throwable) {
            $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
            // provider 明确拒绝提交后任务不会继续运行，需要立即释放本次占用的个人槽位。
            $this->videoQueueDomainService->releaseUserActiveOperation($operation);
            $this->dispatchVideoGenerateFailedEvent(
                $dataIsolation,
                $operation,
                $requestDTO->getBusinessParams(),
            );
            $this->videoQueueDomainService->deleteOperation($operation);
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, $throwable->getMessage(), throwable: $throwable);
        } catch (Throwable $throwable) {
            // 非业务异常会中断提交流程，释放槽位避免残留运行态阻塞后续提交。
            $this->videoQueueDomainService->releaseUserActiveOperation($operation);
            $this->videoQueueDomainService->deleteOperation($operation);
            throw $throwable;
        }
        $this->logger->info('video operation submitted', [
            'operation_id' => $operation->getId(),
            'organization_code' => $operation->getOrganizationCode(),
            'provider_code' => $operation->getProviderCode(),
            'model_id' => $operation->getModel(),
            'provider_model_id' => $operation->getProviderModelId(),
            'provider_task_id' => $providerTaskId,
            'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
        ]);
        $this->videoQueueDomainService->markProviderRunning($operation, $providerTaskId);
        $this->videoQueueDomainService->saveOperation($operation);

        return $this->videoQueueDomainService->buildOperationResponse(
            $operation,
            $this->videoQueueDomainService->buildDirectQueueSnapshot(),
        );
    }

    public function getOperation(string $accessToken, string $operationId, array $businessParams = []): VideoOperationResponseDTO
    {
        $dataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);
        $operation = $this->videoQueueDomainService->getOperation(
            $operationId,
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        );

        $providerTaskId = $operation->getProviderTaskId();
        if (is_string($providerTaskId) && $providerTaskId !== '' && ! $operation->getStatus()->isDone()) {
            $config = $this->queueOperationExecutionDomainService->getConfig($operation);
            try {
                $previousStatus = $operation->getStatus();
                $result = $this->normalizeExecutionResult(
                    $operation,
                    $this->queueOperationExecutionDomainService->query($operation, $config, $providerTaskId),
                );
                $probeResult = $this->extractProbeResult($result);
                $syncResult = $this->videoQueueDomainService->syncWithExecutionResult($operation, $providerTaskId, $result);

                $this->logger->info('video provider query summary', [
                    'operation_id' => $operation->getId(),
                    'organization_code' => $operation->getOrganizationCode(),
                    'provider_code' => $operation->getProviderCode(),
                    'provider_task_id' => $providerTaskId,
                    'provider_status' => $this->extractProviderStatus($result),
                    'internal_status' => $syncResult->getStatus()->value,
                    'video_url_present' => trim((string) ($result['output']['video_url'] ?? '')) !== '',
                    'last_frame_url_present' => trim((string) ($result['output']['last_frame_url'] ?? '')) !== '',
                    'error_code' => is_array($result['error'] ?? null) ? ($result['error']['code'] ?? null) : null,
                ]);

                if ($previousStatus !== $syncResult->getStatus()) {
                    $this->logger->info('video operation status changed', [
                        'operation_id' => $operation->getId(),
                        'organization_code' => $operation->getOrganizationCode(),
                        'provider_task_id' => $providerTaskId,
                        'previous_status' => $previousStatus->value,
                        'current_status' => $syncResult->getStatus()->value,
                    ]);
                }

                if ($syncResult->isFirstSucceeded()) {
                    $this->dispatchVideoGeneratedEvent($dataIsolation, $operation, $probeResult, $businessParams);
                } elseif ($syncResult->isStatusChanged() && $syncResult->getStatus() === VideoOperationStatus::FAILED) {
                    $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $businessParams);
                }
                $this->videoQueueDomainService->saveOperation($operation);
                // provider 查询后如果任务进入终态，立即释放个人视频运行槽位。
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            } catch (ProviderVideoException $throwable) {
                $this->logger->warning('video provider query failed', [
                    'operation_id' => $operation->getId(),
                    'organization_code' => $operation->getOrganizationCode(),
                    'provider_code' => $operation->getProviderCode(),
                    'provider_task_id' => $providerTaskId,
                    'error' => $throwable->getMessage(),
                ]);
                $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
                $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $businessParams);
                $this->videoQueueDomainService->saveOperation($operation);
                // 查询 provider 失败会把任务标记为失败，也需要释放个人视频运行槽位。
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            }
        }
        // 兜底处理：任务查询前已是终态时不会进入 provider 查询分支，这里负责释放残留槽位。
        $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);

        $response = $this->videoQueueDomainService->buildOperationResponse(
            $operation,
            $this->videoQueueDomainService->buildDirectQueueSnapshot(),
        );

        $response->setOutput($this->resolveResponseOutput($operation, $response->getOutput()));

        return $response;
    }

    /**
     * 基于真实提交前的规范化结果。
     */
    private function buildVideoPointEstimateRequest(
        ModelGatewayDataIsolation $dataIsolation,
        CreateVideoDTO $requestDTO,
        ProviderCode $providerCode,
        VideoGenerationConfig $videoGenerationConfig
    ): VideoPointEstimateRequest {
        // 预估和提交共用同一套规范化，避免默认时长、分辨率和 provider 能力校验不一致。
        $normalizedRequest = $this->videoQueueDomainService->normalizeRequestForEstimate(
            $requestDTO,
            $providerCode,
            $videoGenerationConfig
        );
        $outputDetails = $this->videoBillingDetailsResolver->resolveFromRequest($normalizedRequest, $videoGenerationConfig);
        $referenceVideos = is_array($normalizedRequest['inputs']['reference_videos'] ?? null)
            ? $normalizedRequest['inputs']['reference_videos']
            : [];
        $inputMetadata = $this->resolveEstimateInputMetadata($dataIsolation, $requestDTO, $referenceVideos);

        return new VideoPointEstimateRequest(
            $requestDTO->getModel(),
            (string) ($outputDetails['resolution'] ?? ''),
            (int) ($outputDetails['duration_seconds'] ?? 0),
            (int) ($outputDetails['width'] ?? 0),
            (int) ($outputDetails['height'] ?? 0),
            (int) $inputMetadata['total_duration_seconds'],
            (int) $inputMetadata['reference_video_count'] > 0,
            $requestDTO->getBusinessParams(),
        );
    }

    /**
     * 解析参考视频元数据；没有参考视频时返回 0。
     * 工作区路径仍要求 project_id，外部 URL 则由 resolver 直接下载探测。
     *
     * @param list<array<string, mixed>> $referenceVideos
     * @return array{total_duration_seconds: int, reference_video_count: int}
     */
    private function resolveEstimateInputMetadata(
        ModelGatewayDataIsolation $dataIsolation,
        CreateVideoDTO $requestDTO,
        array $referenceVideos
    ): array {
        if ($referenceVideos === []) {
            return [
                'total_duration_seconds' => 0,
                'reference_video_count' => 0,
            ];
        }

        return $this->videoInputMediaMetadataResolver->resolve(
            $dataIsolation,
            $requestDTO->getProjectId(),
            $referenceVideos
        );
    }

    /**
     * 派发视频生成成功事件：供审计、计费（billing-manager）订阅。
     *
     * @param null|array{metadata: VideoMediaMetadata, source: string} $probeResult
     */
    private function dispatchVideoGeneratedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        ?array $probeResult = null,
        array $requestBusinessParams = []
    ): void {
        $event = new VideoGeneratedEvent();
        $accessTokenEntity = $this->resolveAccessTokenEntity($dataIsolation);
        $billingDetails = $this->resolveBillingDetails($operation, $probeResult);
        // 从 provider 轮询结果中取出 usage（如 completion_tokens），供事件、审计与按 token 计费侧使用
        $usageTokens = $this->resolveVideoProviderUsageTokens($operation);
        $businessParams = $this->buildVideoAuditBusinessParams(
            $dataIsolation,
            $operation,
            $requestBusinessParams,
        );
        $referenceMaterial = $this->resolveVideoReferenceMaterialContext($operation);
        if ($usageTokens['completion_tokens'] !== null) {
            $businessParams['completion_tokens'] = $usageTokens['completion_tokens'];
        }
        if ($usageTokens['total_tokens'] !== null) {
            $businessParams['total_tokens'] = $usageTokens['total_tokens'];
        }

        $event->setOrganizationCode($operation->getOrganizationCode());
        $event->setUserId($operation->getUserId());
        $event->setModel($operation->getModel());
        $event->setOriginalModelId($operation->getModel());
        $event->setProviderModelId($operation->getProviderModelId());
        $event->setDurationSeconds($billingDetails['duration_seconds']);
        $event->setResolution($billingDetails['resolution']);
        $event->setSize($billingDetails['size']);
        $event->setWidth($billingDetails['width']);
        $event->setHeight($billingDetails['height']);
        $event->setProjectId($operation->getProjectId());
        $event->setTopicId($operation->getTopicId());
        $event->setTaskId($operation->getTaskId());
        $event->setSourceId($operation->getSourceId());
        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation));
        $event->setCreatedAt(new DateTime());
        $event->setVideoReferenceMaterial($referenceMaterial);
        $event->setBusinessParams($businessParams);
        // 与 businessParams 中字段一致，便于 billing-manager 读事件对象直接扣费
        $event->setCompletionTokens($usageTokens['completion_tokens']);
        $event->setTotalTokens($usageTokens['total_tokens']);

        AsyncEventUtil::dispatch($event);
        $this->logger->info('VideoGeneratedEventDispatched', [
            'operation_id' => $operation->getId(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
            'model' => $event->getModel(),
            'provider_model_id' => $event->getProviderModelId(),
            'duration_seconds' => $event->getDurationSeconds(),
            'resolution' => $event->getResolution(),
            'size' => $event->getSize(),
            'width' => $event->getWidth(),
            'height' => $event->getHeight(),
            'project_id' => $event->getProjectId(),
            'topic_id' => $event->getTopicId(),
            'task_id' => $event->getTaskId(),
            'source_id' => $event->getSourceId(),
            'source_type' => $event->getSourceType()->value,
            'completion_tokens' => $event->getCompletionTokens(),
            'total_tokens' => $event->getTotalTokens(),
            'video_reference_material' => $event->getVideoReferenceMaterial(),
        ]);
    }

    private function dispatchVideoGenerateFailedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        array $requestBusinessParams = []
    ): void {
        $event = new VideoGenerateFailedEvent();
        $businessParams = $this->buildVideoAuditBusinessParams(
            $dataIsolation,
            $operation,
            $requestBusinessParams,
            self::AUDIT_STATUS_FAIL,
        );

        $event->setOrganizationCode($operation->getOrganizationCode());
        $event->setUserId($operation->getUserId());
        $event->setModel($operation->getModel());
        $event->setProviderModelId($operation->getProviderModelId());
        $event->setBusinessParams($businessParams);

        AsyncEventUtil::dispatch($event);
        $this->logger->info('VideoGenerateFailedEventDispatched', [
            'operation_id' => $operation->getId(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
            'model' => $event->getModel(),
            'provider_model_id' => $event->getProviderModelId(),
        ]);
    }

    private function buildVideoAuditBusinessParams(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        array $requestBusinessParams = [],
        string $status = self::AUDIT_STATUS_SUCCESS
    ): array {
        $accessTokenEntity = $this->resolveAccessTokenEntity($dataIsolation);
        $sourceId = (string) ($operation->getSourceId() ?: $dataIsolation->getSourceId());
        $requestId = CoContext::getRequestId();
        $magicTopicId = trim((string) ($requestBusinessParams['magic_topic_id'] ?? ''));
        $accessTokenName = (string) $accessTokenEntity?->getName();
        $accessTokenType = $accessTokenEntity === null ? '' : $accessTokenEntity->getType()->value;
        $providerName = $operation->getAuditProviderName();

        $params = [
            'event_id' => (string) IdGenerator::getSnowId(),
            'model_id' => $operation->getModel(),
            'model_version' => $operation->getModelVersion(),
            'provider_model_id' => $operation->getProviderModelId(),
            'provider_name' => $providerName,
            'original_model_id' => $operation->getModel(),
            'status' => $status,
            'operation_time' => $this->toTimestampMs($operation->getCreatedAt()),
            'response_duration' => $this->calculateLatencyMs($operation),
            'organization_id' => $operation->getOrganizationCode(),
            'user_id' => $operation->getUserId(),
            'user_name' => $dataIsolation->getUserName(),
            'app_id' => $dataIsolation->getAppId(),
            'source_id' => $sourceId,
            'request_id' => $requestId,
            'magic_topic_id' => $magicTopicId,
            'ak' => $accessTokenEntity?->getAccessToken() ?? '',
            'access_token_name' => $accessTokenName,
            'access_token_type' => $accessTokenType,
        ];
        if ($status === self::AUDIT_STATUS_FAIL) {
            $msg = (string) $operation->getErrorMessage();
            $code = (string) $operation->getErrorCode();
            $params['failure_reason'] = $code !== '' ? "{$code}: {$msg}" : $msg;
        }

        return $params;
    }

    /**
     * 解析视频任务 provider 回包中的 token 用量（如火山方舟 succeeded 时的 usage.completion_tokens）。
     * 无字段或非法结构时返回 null，计费侧可回退到按时长等规则。
     *
     * @return array{completion_tokens: ?int, total_tokens: ?int}
     */
    private function resolveVideoProviderUsageTokens(VideoQueueOperationEntity $operation): array
    {
        $providerResult = $operation->getProviderResult();
        if (! is_array($providerResult)) {
            return ['completion_tokens' => null, 'total_tokens' => null];
        }
        $usage = $providerResult['usage'] ?? null;
        if (! is_array($usage)) {
            return ['completion_tokens' => null, 'total_tokens' => null];
        }
        $completion = $usage['completion_tokens'] ?? null;
        $total = $usage['total_tokens'] ?? null;

        return [
            'completion_tokens' => $completion !== null ? max(0, (int) $completion) : null,
            'total_tokens' => $total !== null ? max(0, (int) $total) : null,
        ];
    }

    private function toTimestampMs(?string $time): int
    {
        return max(0, ((int) strtotime((string) $time)) * 1000);
    }

    private function calculateLatencyMs(VideoQueueOperationEntity $operation): int
    {
        $finishedAtMs = $this->toTimestampMs($operation->getFinishedAt());
        if ($finishedAtMs === 0) {
            $finishedAtMs = (int) round(microtime(true) * 1000);
        }

        return max(
            0,
            $finishedAtMs - $this->toTimestampMs($operation->getCreatedAt())
        );
    }

    private function resolveResponseOutput(VideoQueueOperationEntity $operation, array $output): array
    {
        $fileKey = $this->buildStoredVideoFileKey($operation);
        if ($fileKey === null) {
            return $output;
        }

        try {
            $fileLink = $this->fileDomainService->getLink(
                $operation->getOrganizationCode(),
                $fileKey,
                StorageBucketType::Private,
            );
            $signedUrl = trim((string) $fileLink?->getUrl());
            if ($signedUrl === '') {
                return $output;
            }

            $output['video_url'] = $signedUrl;
            return $output;
        } catch (Throwable $throwable) {
            $this->logger->warning('video provider result resign failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'file_key' => $fileKey,
                'error' => $throwable->getMessage(),
            ]);

            return $output;
        }
    }

    private function buildStoredVideoFileKey(VideoQueueOperationEntity $operation): ?string
    {
        $fileDir = trim((string) $operation->getFileDir());
        $fileName = trim((string) $operation->getFileName());
        if ($fileDir === '' || $fileName === '') {
            return null;
        }

        return trim($fileDir, '/') . '/' . ltrim($fileName, '/');
    }

    private function normalizeExecutionResult(VideoQueueOperationEntity $operation, array $result): array
    {
        $providerResult = is_array($result['provider_result'] ?? null) ? $result['provider_result'] : null;
        if ($providerResult === null) {
            return $result;
        }

        $result['provider_result'] = $this->stripProviderVideoBytes($providerResult);
        $output = is_array($result['output'] ?? null) ? $result['output'] : [];
        if (trim((string) ($output['video_url'] ?? '')) !== '') {
            return $result;
        }

        $providerVideo = $this->extractProviderVideoBytes($providerResult);
        if ($providerVideo === null) {
            return $result;
        }

        $uploadResult = $this->uploadProviderVideoBytes(
            $operation,
            $providerVideo['bytes_base64_encoded'],
            $providerVideo['mime_type'],
        );
        $output['video_url'] = $uploadResult['video_url'];
        if ($uploadResult['probe_result'] !== null) {
            $result[self::INTERNAL_PROBE_RESULT_KEY] = $uploadResult['probe_result'];
        }
        $result['output'] = $output;

        return $result;
    }

    /**
     * @param array<string, mixed> $result
     * @return null|array{metadata: VideoMediaMetadata, source: string}
     */
    private function extractProbeResult(array $result): ?array
    {
        $probeResult = $result[self::INTERNAL_PROBE_RESULT_KEY] ?? null;
        if (! is_array($probeResult) || ! ($probeResult['metadata'] ?? null) instanceof VideoMediaMetadata || ! is_string($probeResult['source'] ?? null)) {
            return null;
        }

        return $probeResult;
    }

    private function extractProviderStatus(array $result): ?string
    {
        $providerResult = is_array($result['provider_result'] ?? null) ? $result['provider_result'] : [];
        $status = trim((string) ($providerResult['status'] ?? $providerResult['data']['status'] ?? ''));

        return $status === '' ? null : $status;
    }

    /**
     * @param null|array{metadata: VideoMediaMetadata, source: string} $probeResult
     * @return array{duration_seconds: int, resolution: ?string, size: ?string, width: ?int, height: ?int}
     */
    private function resolveBillingDetails(VideoQueueOperationEntity $operation, ?array $probeResult = null): array
    {
        $resolvedProbeResult = $probeResult ?? $this->probeGeneratedVideo($operation);
        if ($resolvedProbeResult !== null) {
            $billingDetails = $this->videoBillingDetailsResolver->resolveFromMetadata($resolvedProbeResult['metadata']);
            $this->logger->info('video billing probe success', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'probe_source' => $resolvedProbeResult['source'],
                'fallback_used' => false,
                'error' => null,
            ]);

            return $billingDetails;
        }

        $this->logger->warning('video billing probe fallback', [
            'operation_id' => $operation->getId(),
            'organization_code' => $operation->getOrganizationCode(),
            'probe_source' => 'fallback',
            'fallback_used' => true,
            'error' => 'video media probe unavailable',
        ]);

        return $this->videoBillingDetailsResolver->resolveFromFallback($operation);
    }

    /**
     * @return null|array{metadata: VideoMediaMetadata, source: string}
     */
    private function probeGeneratedVideo(VideoQueueOperationEntity $operation): ?array
    {
        $probeSources = [];
        $fileKey = $this->buildStoredVideoFileKey($operation);
        if ($fileKey !== null) {
            try {
                $fileLink = $this->fileDomainService->getLink(
                    $operation->getOrganizationCode(),
                    $fileKey,
                    StorageBucketType::Private,
                );
                $signedUrl = trim((string) $fileLink?->getUrl());
                if ($signedUrl !== '') {
                    $probeSources[] = [
                        'url' => $signedUrl,
                        'source' => 'stored_file',
                    ];
                }
            } catch (Throwable $throwable) {
                $this->logger->warning('video billing probe failed', [
                    'operation_id' => $operation->getId(),
                    'organization_code' => $operation->getOrganizationCode(),
                    'probe_source' => 'stored_file',
                    'fallback_used' => false,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }

        $videoUrl = trim((string) ($operation->getOutput()['video_url'] ?? ''));
        if ($videoUrl !== '') {
            $alreadyAdded = false;
            foreach ($probeSources as $probeSource) {
                if (($probeSource['url'] ?? null) === $videoUrl) {
                    $alreadyAdded = true;
                    break;
                }
            }
            if (! $alreadyAdded) {
                $probeSources[] = [
                    'url' => $videoUrl,
                    'source' => 'provider_output_url',
                ];
            }
        }

        foreach ($probeSources as $probeSource) {
            $probeResult = $this->probeVideoFromUrl(
                $operation,
                (string) $probeSource['url'],
                (string) $probeSource['source'],
            );
            if ($probeResult !== null) {
                return $probeResult;
            }
        }

        return null;
    }

    /**
     * @return null|array{metadata: VideoMediaMetadata, source: string}
     */
    private function probeVideoFromUrl(VideoQueueOperationEntity $operation, string $url, string $probeSource): ?array
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'video-probe-');
        if ($tempPath === false) {
            $this->logger->warning('video billing probe failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'probe_source' => $probeSource,
                'fallback_used' => false,
                'error' => 'create temporary probe file failed',
            ]);

            return null;
        }

        try {
            $this->downloadProbeSourceToTempFile($url, $tempPath);
            return $this->probeVideoFromFile($operation, $tempPath, $probeSource);
        } catch (Throwable $throwable) {
            $this->logger->warning('video billing probe failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'probe_source' => $probeSource,
                'fallback_used' => false,
                'error' => $throwable->getMessage(),
            ]);

            return null;
        } finally {
            @unlink($tempPath);
        }
    }

    private function downloadProbeSourceToTempFile(string $url, string $tempPath): void
    {
        // Probe sources come from provider execution results; keep the URL safety checks,
        // but skip the extra redirect probe so we do not depend on live network behavior here.
        $safeUrl = SSRFUtil::getSafeUrl($url, replaceIp: false, allowRedirect: true);
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);
        $remoteStream = fopen($safeUrl, 'rb', false, $context);
        $localStream = fopen($tempPath, 'wb');
        if (! is_resource($remoteStream) || ! is_resource($localStream)) {
            if (is_resource($remoteStream)) {
                fclose($remoteStream);
            }
            if (is_resource($localStream)) {
                fclose($localStream);
            }
            throw new RuntimeException('open video probe stream failed');
        }

        try {
            $downloadedBytes = 0;
            while (! feof($remoteStream)) {
                $buffer = fread($remoteStream, self::STREAM_BUFFER_BYTES);
                if ($buffer === false) {
                    throw new RuntimeException('read video probe stream failed');
                }
                if ($buffer === '') {
                    continue;
                }

                $downloadedBytes += strlen($buffer);
                if ($downloadedBytes > self::PROBE_DOWNLOAD_MAX_BYTES) {
                    throw new RuntimeException('video probe file exceeds max size');
                }

                if (fwrite($localStream, $buffer) === false) {
                    throw new RuntimeException('write video probe temp file failed');
                }
            }
        } finally {
            fclose($remoteStream);
            fclose($localStream);
        }
    }

    /**
     * @return null|array{metadata: VideoMediaMetadata, source: string}
     */
    private function probeVideoFromFile(VideoQueueOperationEntity $operation, string $filePath, string $probeSource): ?array
    {
        try {
            return [
                'metadata' => $this->videoMediaProbe->probe($filePath),
                'source' => $probeSource,
            ];
        } catch (Throwable $throwable) {
            $this->logger->warning('video billing probe failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'probe_source' => $probeSource,
                'fallback_used' => false,
                'error' => $throwable->getMessage(),
            ]);

            return null;
        }
    }

    private function resolveSourceType(?AccessTokenEntity $accessTokenEntity, VideoQueueOperationEntity $operation): ImageGenerateSourceEnum
    {
        if ($accessTokenEntity?->getType()->isUser()) {
            return ImageGenerateSourceEnum::API_PLATFORM;
        }

        if (trim((string) $operation->getTopicId()) !== '') {
            return ImageGenerateSourceEnum::SUPER_MAGIC;
        }

        return ImageGenerateSourceEnum::API;
    }

    private function resolveAccessTokenEntity(ModelGatewayDataIsolation $dataIsolation): ?AccessTokenEntity
    {
        try {
            return $dataIsolation->getAccessToken();
        } catch (BaseThrowable) {
            return null;
        }
    }

    /**
     * @return null|array{bytes_base64_encoded: string, mime_type: string}
     */
    private function extractProviderVideoBytes(array $providerResult): ?array
    {
        $payloadCandidates = [];
        if (is_array($providerResult['data'] ?? null)) {
            $payloadCandidates[] = $providerResult['data'];
        }
        $payloadCandidates[] = $providerResult;

        foreach ($payloadCandidates as $payload) {
            $response = is_array($payload['response'] ?? null) ? $payload['response'] : null;
            $videos = is_array($response['videos'] ?? null) ? $response['videos'] : null;
            if ($videos === null) {
                continue;
            }

            foreach ($videos as $video) {
                if (! is_array($video)) {
                    continue;
                }

                $bytesBase64Encoded = trim((string) ($video['bytesBase64Encoded'] ?? ''));
                if ($bytesBase64Encoded === '') {
                    continue;
                }

                return [
                    'bytes_base64_encoded' => $bytesBase64Encoded,
                    'mime_type' => trim((string) ($video['mimeType'] ?? '')),
                ];
            }
        }

        return null;
    }

    private function stripProviderVideoBytes(array $providerResult): array
    {
        foreach (['data', null] as $dataKey) {
            $payload = $this->resolveProviderResultPayload($providerResult, $dataKey);
            if ($payload === null) {
                continue;
            }

            $response = is_array($payload['response'] ?? null) ? $payload['response'] : null;
            $videos = is_array($response['videos'] ?? null) ? $response['videos'] : null;
            if ($videos === null) {
                continue;
            }

            foreach ($videos as $index => $video) {
                if (! is_array($video)) {
                    continue;
                }
                unset($videos[$index]['bytesBase64Encoded']);
            }

            $payload['response']['videos'] = $videos;
            $providerResult = $this->storeProviderResultPayload($providerResult, $dataKey, $payload);
        }

        return $providerResult;
    }

    private function resolveProviderResultPayload(array $providerResult, ?string $dataKey): ?array
    {
        if ($dataKey === null) {
            return $providerResult;
        }

        return is_array($providerResult[$dataKey] ?? null) ? $providerResult[$dataKey] : null;
    }

    private function storeProviderResultPayload(array $providerResult, ?string $dataKey, array $payload): array
    {
        if ($dataKey === null) {
            return $payload;
        }

        $providerResult[$dataKey] = $payload;
        return $providerResult;
    }

    /**
     * @return array{
     *     video_url: string,
     *     probe_result: null|array{metadata: VideoMediaMetadata, source: string}
     * }
     */
    private function uploadProviderVideoBytes(
        VideoQueueOperationEntity $operation,
        string $bytesBase64Encoded,
        string $mimeType
    ): array {
        $binary = base64_decode($bytesBase64Encoded, true);
        if ($binary === false) {
            throw new RuntimeException('invalid provider video base64 payload');
        }

        $extension = $this->resolveVideoExtension($mimeType);
        $tempPath = tempnam(sys_get_temp_dir(), 'video-result-');
        if ($tempPath === false) {
            throw new RuntimeException('create temporary video file failed');
        }

        $uploadPath = $tempPath . '.' . $extension;
        if (! rename($tempPath, $uploadPath)) {
            @unlink($tempPath);
            throw new RuntimeException('prepare temporary video file failed');
        }

        try {
            if (file_put_contents($uploadPath, $binary) === false) {
                throw new RuntimeException('write temporary video file failed');
            }
            $probeResult = $this->probeVideoFromFile($operation, $uploadPath, 'provider_bytes');

            $uploadFile = new UploadFile(
                $uploadPath,
                'open/video-generation',
                $operation->getId() . '.' . $extension,
                false,
            );
            $normalizedMimeType = trim($mimeType) !== '' ? $mimeType : null;
            $this->fileDomainService->uploadByCredential(
                $operation->getOrganizationCode(),
                $uploadFile,
                StorageBucketType::Private,
                true,
                $normalizedMimeType,
            );
            $fileKey = trim($uploadFile->getKey());
            if ($fileKey === '') {
                throw new RuntimeException('uploaded provider video file key missing');
            }
            $operation->setFileDir(dirname($fileKey));
            $operation->setFileName(basename($fileKey));

            $fileLink = $this->fileDomainService->getLink(
                $operation->getOrganizationCode(),
                $fileKey,
                StorageBucketType::Private,
            );
            $videoUrl = trim((string) $fileLink?->getUrl());
            if ($videoUrl === '') {
                throw new RuntimeException('uploaded provider video signed url missing');
            }

            $this->logger->info('video provider result uploaded', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'file_key' => $fileKey,
                'bucket_type' => StorageBucketType::Private->value,
                'mime_type' => $normalizedMimeType,
            ]);

            return [
                'video_url' => $videoUrl,
                'probe_result' => $probeResult,
            ];
        } finally {
            @unlink($uploadPath);
        }
    }

    private function resolveVideoExtension(string $mimeType): string
    {
        return match (strtolower(trim($mimeType))) {
            'video/quicktime', 'video/mov' => 'mov',
            'video/avi' => 'avi',
            'video/mpeg', 'video/mpg', 'video/mpegps' => 'mpeg',
            'video/x-flv', 'video/flv' => 'flv',
            'video/wmv', 'video/x-ms-wmv' => 'wmv',
            default => 'mp4',
        };
    }

    /**
     * 从入队时的 raw_request 解析参考素材，与 VideoGeneratedEvent::videoReferenceMaterial 结构一致。
     *
     * @return array{
     *     input_mode: ?string,
     *     reference_image_count: int,
     *     reference_video_count: int,
     *     reference_audio_count: int
     * }
     */
    private function resolveVideoReferenceMaterialContext(VideoQueueOperationEntity $operation): array
    {
        $raw = $operation->getRawRequest();
        $inputs = is_array($raw['inputs'] ?? null) ? $raw['inputs'] : [];
        $inputMode = isset($raw['input_mode']) ? trim((string) $raw['input_mode']) : '';

        $images = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $videos = is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : [];
        $audios = is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : [];

        return [
            'input_mode' => $inputMode === '' ? null : $inputMode,
            'reference_image_count' => count($images),
            'reference_video_count' => count($videos),
            'reference_audio_count' => count($audios),
        ];
    }
}

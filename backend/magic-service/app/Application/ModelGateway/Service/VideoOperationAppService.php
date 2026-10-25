<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Component\Points\DTO\PointEstimateResult;
use App\Application\ModelGateway\Component\Points\DTO\VideoPointEstimateRequest;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Event\Message\VideoOperationPollMessage;
use App\Application\ModelGateway\Event\Publish\VideoOperationPollDelayPublisher;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\Video\VideoInputMediaMetadataResolver;
use App\Application\ModelGateway\Support\InvocationDetailInfo;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\ValueObject\VideoTaskType;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGenerateFailedEvent;
use App\Domain\ModelGateway\Service\QueueOperationExecutionDomainService;
use App\Domain\ModelGateway\Service\VideoBillingDetailsResolver;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use App\Domain\Operation\Event\OperationUsageFinishedEvent;
use App\Domain\Operation\Event\OperationUsageWillStartEvent;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Log\PayloadLogSanitizer;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use Hyperf\Amqp\Producer;
use Psr\EventDispatcher\EventDispatcherInterface;
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

    private const string AUDIT_STATUS_SUCCESS = 'SUCCESS';

    private const string AUDIT_STATUS_FAIL = 'FAIL';

    private const string SYNC_LOCK_PREFIX = 'model_gateway_video_operation_sync:';

    private const int PRE_SUBMIT_ACTIVE_OPERATION_GRACE_SECONDS = 120;

    private const string OPERATION_NAME_VIDEO_GENERATE = 'model_gateway.video.generate';

    private const string EXECUTION_KEY_VIDEO_PREFIX = 'video_operation:';

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
        private GeminiVideoClient $geminiVideoClient,
        private SafeRemoteFileDownloader $remoteFileDownloader,
        private VideoInputMediaMetadataResolver $videoInputMediaMetadataResolver,
        private Producer $producer,
        private LockerInterface $locker,
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
            $videoModel->getModelVersion(),
            $videoModel->getProviderModelId(),
            $videoGenerationConfig,
        );
        $result = $this->pointComponent->estimateVideoPoints($estimateRequest, $dataIsolation);
        $this->logger->info('video point estimate calculated', [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'model_id' => $requestDTO->getModel(),
            'provider_code' => $videoModel->getProviderCode(),
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
        //        $this->pointComponent->checkPointsSufficient($requestDTO, $dataIsolation); TODO: 下面已经做了积分预冻结，所以这里不需要检查积分是否充足，后续看看如何统一两者
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

        // 占用新槽位前主动同步当前用户运行中的旧任务，释放已完成但调用方未轮询的残留槽位。
        $this->recoverUserActiveOperationsBeforeClaim($operation);

        $operationUsageEventDispatched = false;
        try {
            // 提交 provider 前先按套餐占用个人视频运行槽位
            $this->videoQueueDomainService->claimUserActiveOperation(
                $operation,
                $personalVideoGenerationConcurrencyLimit,
            );
            $this->videoQueueDomainService->saveOperation($operation);

            $config = $this->queueOperationExecutionDomainService->getConfig($operation);

            $this->dispatchOperationUsageWillStart(
                $dataIsolation,
                $operation,
                $this->buildVideoPointEstimateRequest(
                    $dataIsolation,
                    $requestDTO,
                    $videoModel->getProviderCode(),
                    $videoModel->getModelVersion(),
                    $videoModel->getProviderModelId(),
                    $videoGenerationConfig,
                ),
                $requestDTO->getBusinessParams(),
            );
            $operationUsageEventDispatched = true;

            $providerTaskId = $this->queueOperationExecutionDomainService->submit($operation, $config);
        } catch (ProviderVideoException $throwable) {
            $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
            // provider 明确拒绝提交后任务不会继续运行，需要立即释放本次占用的个人槽位。
            $this->videoQueueDomainService->releaseUserActiveOperation($operation);
            $this->dispatchVideoGenerateFailedEvent(
                $dataIsolation,
                $operation,
                $requestDTO->getBusinessParams(),
                $throwable
            );
            $this->videoQueueDomainService->deleteOperation($operation);
            ExceptionBuilder::throw($throwable->getVideoErrorCode(), $throwable->getMessage(), throwable: $throwable);
        } catch (Throwable $throwable) {
            // 非业务异常会中断提交流程，释放槽位避免残留运行态阻塞后续提交。
            $this->videoQueueDomainService->releaseUserActiveOperation($operation);
            if ($operationUsageEventDispatched) {
                $this->dispatchOperationUsageFinished($operation, OperationUsageFinishedEvent::STATUS_FAILED);
            }
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
        if ($requestDTO->isManagedPollingEnabled()) {
            try {
                $this->dispatchInitialPollMessage(
                    $operation,
                    $this->buildManagedPollBusinessParams($dataIsolation, $requestDTO->getBusinessParams()),
                );
            } catch (Throwable $throwable) {
                // 首条托管轮询消息投递失败时保留运行槽位，下一次并发满恢复流程仍可查询 provider 并释放。
                throw $throwable;
            }
        }

        return $this->videoQueueDomainService->buildOperationResponse(
            $operation,
            $this->videoQueueDomainService->buildDirectQueueSnapshot(),
        );
    }

    public function getOperation(string $accessToken, string $operationId, array $businessParams = []): VideoOperationResponseDTO
    {
        $dataIsolation = $this->llmAppService->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams, enforceRuntimePermission: false);
        $this->videoQueueDomainService->getOperation(
            $operationId,
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        );

        $operation = $this->syncOperationFromProviderWithLock(
            $dataIsolation,
            $operationId,
            $businessParams,
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        );
        if ($operation === null) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video task not found');
        }

        $response = $this->videoQueueDomainService->buildOperationResponse(
            $operation,
            $this->videoQueueDomainService->buildDirectQueueSnapshot(),
        );

        $response->setOutput($this->resolveResponseOutput($operation, $response->getOutput()));

        return $response;
    }

    /**
     * 按 provider 规则把远程媒体下载到本地文件，供计费探测和归档上传共用。
     */
    public function downloadOperationMediaToLocalFile(string $operationId, string $url): string
    {
        $operation = $this->videoQueueDomainService->findOperation($operationId);
        if ($operation === null) {
            throw new RuntimeException('video operation not found');
        }

        $executorConfig = $this->queueOperationExecutionDomainService->getConfig($operation);
        if ($operation->getProviderCode() === ProviderCode::Gemini->value) {
            return $this->geminiVideoClient->downloadMediaToLocalFile(
                $executorConfig,
                $url,
            );
        }

        return $this->remoteFileDownloader->download($url)->getRealPath();
    }

    public function pollOperationById(string $operationId, array $businessParams = []): bool
    {
        $operation = $this->videoQueueDomainService->findOperation($operationId);
        if ($operation === null) {
            $this->logger->warning('video operation poll skipped: operation not found', [
                'operation_id' => $operationId,
            ]);
            return true;
        }

        $dataIsolation = ModelGatewayDataIsolation::create($operation->getOrganizationCode(), $operation->getUserId());
        $operation = $this->syncOperationFromProviderWithLock(
            $dataIsolation,
            $operationId,
            $businessParams,
        );
        if ($operation === null) {
            return true;
        }

        return $operation->getStatus()->isDone();
    }

    public function timeoutOperationById(string $operationId, array $businessParams = []): void
    {
        $this->withOperationLock($operationId, function () use ($operationId, $businessParams): void {
            $operation = $this->videoQueueDomainService->findOperation($operationId);
            if ($operation === null) {
                return;
            }

            if ($operation->getStatus()->isDone()) {
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
                return;
            }

            $dataIsolation = ModelGatewayDataIsolation::create($operation->getOrganizationCode(), $operation->getUserId());
            $this->videoQueueDomainService->finishProviderTimeout($operation);
            $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $businessParams);
            $this->videoQueueDomainService->saveOperation($operation);
            $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            $this->logger->warning('video operation marked timeout by poll consumer', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'provider_task_id' => $operation->getProviderTaskId(),
            ]);
        });
    }

    private function recoverUserActiveOperationsBeforeClaim(
        VideoQueueOperationEntity $newOperation,
    ): void {
        $activeOperations = $this->videoQueueDomainService->getUserActiveOperations(
            $newOperation->getOrganizationCode(),
            $newOperation->getUserId(),
        );

        foreach ($activeOperations as $activeOperation) {
            if ($activeOperation->getId() === $newOperation->getId()) {
                continue;
            }
            $activeDataIsolation = ModelGatewayDataIsolation::create(
                $activeOperation->getOrganizationCode(),
                $activeOperation->getUserId(),
            );

            $providerTaskId = trim((string) $activeOperation->getProviderTaskId());
            if ($providerTaskId !== '') {
                try {
                    $this->syncOperationFromProviderWithLock(
                        $activeDataIsolation,
                        $activeOperation->getId(),
                        [],
                        $newOperation->getOrganizationCode(),
                        $newOperation->getUserId(),
                    );
                } catch (Throwable $throwable) {
                    $this->logger->warning('video active operation recovery query failed', [
                        'operation_id' => $activeOperation->getId(),
                        'organization_code' => $activeOperation->getOrganizationCode(),
                        'user_id' => $activeOperation->getUserId(),
                        'provider_task_id' => $providerTaskId,
                        'error' => $throwable->getMessage(),
                    ]);
                }
                continue;
            }

            $this->failStalePreSubmitActiveOperation($activeDataIsolation, $activeOperation->getId(), []);
        }
    }

    private function failStalePreSubmitActiveOperation(
        ModelGatewayDataIsolation $dataIsolation,
        string $operationId,
        array $businessParams,
    ): void {
        $this->withOperationLock($operationId, function () use ($dataIsolation, $operationId, $businessParams): void {
            $operation = $this->videoQueueDomainService->findOperation($operationId);
            if ($operation === null) {
                return;
            }
            if ($operation->getStatus()->isDone()) {
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
                return;
            }
            if (trim((string) $operation->getProviderTaskId()) !== '' || ! $this->isStalePreSubmitOperation($operation)) {
                return;
            }

            $this->videoQueueDomainService->finishExecutionFailure($operation, 'video operation lost before provider submission');
            $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $businessParams);
            $this->videoQueueDomainService->saveOperation($operation);
            $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            $this->logger->warning('video stale pre-submit active operation released', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'user_id' => $operation->getUserId(),
                'created_at' => $operation->getCreatedAt(),
            ]);
        });
    }

    private function isStalePreSubmitOperation(VideoQueueOperationEntity $operation): bool
    {
        $createdAt = strtotime((string) $operation->getCreatedAt());
        if ($createdAt === false) {
            return false;
        }

        return time() - $createdAt >= self::PRE_SUBMIT_ACTIVE_OPERATION_GRACE_SECONDS;
    }

    private function syncOperationFromProviderWithLock(
        ModelGatewayDataIsolation $dataIsolation,
        string $operationId,
        array $businessParams = [],
        ?string $organizationCode = null,
        ?string $userId = null,
    ): ?VideoQueueOperationEntity {
        return $this->withOperationLock($operationId, function () use (
            $dataIsolation,
            $operationId,
            $businessParams,
            $organizationCode,
            $userId,
        ): ?VideoQueueOperationEntity {
            $operation = $this->videoQueueDomainService->findOperation($operationId);
            if ($operation === null) {
                return null;
            }
            if ($organizationCode !== null && $operation->getOrganizationCode() !== $organizationCode) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video task not found');
            }
            if ($userId !== null && $operation->getUserId() !== $userId) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video task not found');
            }

            $this->syncOperationFromProvider($dataIsolation, $operation, $businessParams);
            return $operation;
        });
    }

    private function syncOperationFromProvider(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        array $businessParams = [],
    ): void {
        $providerTaskId = $operation->getProviderTaskId();
        if (! is_string($providerTaskId) || $providerTaskId === '' || $operation->getStatus()->isDone()) {
            $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            return;
        }

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

            try {
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
            } finally {
                $this->videoQueueDomainService->saveOperation($operation);
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            }
        } catch (ProviderVideoException $throwable) {
            if ($throwable->isRetry()) {
                throw $throwable;
            }
            $this->logger->warning('video provider query failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'provider_code' => $operation->getProviderCode(),
                'provider_task_id' => $providerTaskId,
                'error' => $throwable->getMessage(),
            ]);
            $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
            try {
                $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $businessParams, $throwable);
            } finally {
                $this->videoQueueDomainService->saveOperation($operation);
                $this->videoQueueDomainService->releaseUserActiveOperationIfDone($operation);
            }
        }
    }

    private function dispatchInitialPollMessage(VideoQueueOperationEntity $operation, array $businessParams): void
    {
        try {
            $this->producer->produce(new VideoOperationPollDelayPublisher(new VideoOperationPollMessage(
                $operation->getId(),
                $businessParams,
            )));
        } catch (Throwable $throwable) {
            $this->logger->error('video operation poll dispatch failed', [
                'operation_id' => $operation->getId(),
                'organization_code' => $operation->getOrganizationCode(),
                'error' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }
    }

    /**
     * @template T
     * @param callable(): T $callback
     * @return T
     */
    private function withOperationLock(string $operationId, callable $callback): mixed
    {
        $owner = IdGenerator::getUuid();
        $lockKey = self::SYNC_LOCK_PREFIX . $operationId;
        if (! $this->locker->spinLock($lockKey, $owner, $this->videoQueueDomainService->lockExpireSeconds(), 3)) {
            ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT, 'video operation sync lock busy');
        }

        try {
            return $callback();
        } finally {
            $this->locker->release($lockKey, $owner);
        }
    }

    private function buildManagedPollBusinessParams(ModelGatewayDataIsolation $dataIsolation, array $businessParams): array
    {
        $accessTokenEntity = $this->resolveAccessTokenEntity($dataIsolation);
        if ($accessTokenEntity !== null) {
            $businessParams['ak'] = $accessTokenEntity->getAccessToken();
            $businessParams['access_token_id'] = $accessTokenEntity->getId();
            $businessParams['access_token_name'] = $accessTokenEntity->getName();
            $businessParams['access_token_type'] = $accessTokenEntity->getType()->value;
        }
        if ($dataIsolation->getAppId() !== '') {
            $businessParams['app_id'] = $dataIsolation->getAppId();
        }
        if ($dataIsolation->getUserName() !== '') {
            $businessParams['user_name'] = $dataIsolation->getUserName();
        }

        return $businessParams;
    }

    /**
     * 基于真实提交前的规范化结果。
     */
    private function buildVideoPointEstimateRequest(
        ModelGatewayDataIsolation $dataIsolation,
        CreateVideoDTO $requestDTO,
        ProviderCode $providerCode,
        string $modelVersion,
        string $providerModelId,
        VideoGenerationConfig $videoGenerationConfig
    ): VideoPointEstimateRequest {
        // 预估和提交共用同一套规范化，避免默认时长、分辨率和 provider 能力校验不一致。
        $normalizedRequest = $this->videoQueueDomainService->normalizeRequestForEstimate(
            $requestDTO,
            $providerCode,
            $videoGenerationConfig
        );
        $referenceVideos = is_array($normalizedRequest['inputs']['reference_videos'] ?? null) ? $normalizedRequest['inputs']['reference_videos'] : [];
        $inputMedia = is_array($normalizedRequest['inputs'] ?? null) ? $normalizedRequest['inputs'] : [];

        $inputMetadata = $this->resolveEstimateInputMetadata($dataIsolation, $requestDTO, $referenceVideos);
        if ($requestDTO->getTask() === VideoTaskType::Edit->value) {
            $normalizedRequest['generation']['duration_seconds'] = (int) $inputMetadata['total_duration_seconds'];
        }

        $outputDetails = $this->videoBillingDetailsResolver->resolveFromRequest($normalizedRequest, $videoGenerationConfig);
        $hasAudioOutput = $this->videoGenerationConfigDomainService->resolveHasAudioOutput(
            $modelVersion,
            $requestDTO->getModel(),
            $providerCode,
            $normalizedRequest,
        );

        return new VideoPointEstimateRequest(
            $requestDTO->getModel(),
            $providerModelId,
            (string) ($outputDetails['resolution'] ?? ''),
            (int) ($outputDetails['duration_seconds'] ?? 0),
            (int) ($outputDetails['width'] ?? 0),
            (int) ($outputDetails['height'] ?? 0),
            (int) $inputMetadata['total_duration_seconds'],
            (int) $inputMetadata['reference_video_count'] > 0,
            $requestDTO->getBusinessParams(),
            $hasAudioOutput,
            $inputMedia,
            $providerCode->value,
        );
    }

    private function dispatchOperationUsageWillStart(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        VideoPointEstimateRequest $estimateRequest,
        array $requestBusinessParams
    ): void {
        $event = new OperationUsageWillStartEvent(
            executionKey: $this->buildOperationUsageExecutionKey($operation),
            operationName: self::OPERATION_NAME_VIDEO_GENERATE,
            organizationCode: $operation->getOrganizationCode(),
            userId: $operation->getUserId(),
            sourceId: $operation->getSourceId() ?: $dataIsolation->getSourceId(),
            usage: $this->buildVideoOperationUsage($dataIsolation, $operation, $estimateRequest),
            businessParams: $this->buildManagedPollBusinessParams($dataIsolation, $requestBusinessParams),
        );

        di(EventDispatcherInterface::class)->dispatch($event);
        $this->logger->info('OperationUsageWillStartEventDispatched', [
            'execution_key' => $event->getExecutionKey(),
            'operation_name' => $event->getOperationName(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
        ]);
    }

    private function dispatchOperationUsageFinished(VideoQueueOperationEntity $operation, string $status): void
    {
        $event = new OperationUsageFinishedEvent(
            executionKey: $this->buildOperationUsageExecutionKey($operation),
            status: $status,
            organizationCode: $operation->getOrganizationCode(),
            userId: $operation->getUserId(),
            sourceId: $operation->getSourceId(),
            failureCode: $status === OperationUsageFinishedEvent::STATUS_FAILED ? $operation->getErrorCode() : null,
            failureReason: $status === OperationUsageFinishedEvent::STATUS_FAILED ? $operation->getErrorMessage() : null,
        );

        AsyncEventUtil::dispatch($event);
        $this->logger->info('OperationUsageFinishedEventDispatched', [
            'execution_key' => $event->getExecutionKey(),
            'status' => $event->getStatus(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildVideoOperationUsage(ModelGatewayDataIsolation $dataIsolation, VideoQueueOperationEntity $operation, VideoPointEstimateRequest $estimateRequest): array
    {
        $referenceMaterial = $this->resolveVideoReferenceMaterialContext($dataIsolation, $operation);

        return [
            'model' => $estimateRequest->getModelId(),
            'provider_model_id' => $estimateRequest->getProviderModelId(),
            'provider_code' => $estimateRequest->getProviderCode(),
            'resolution' => $estimateRequest->getResolution(),
            'output_duration_seconds' => $estimateRequest->getOutputDurationSeconds(),
            'output_width' => $estimateRequest->getOutputWidth(),
            'output_height' => $estimateRequest->getOutputHeight(),
            'input_video_duration_seconds' => $estimateRequest->getInputVideoDurationSeconds(),
            'has_reference_video' => $estimateRequest->hasReferenceVideo(),
            'has_audio_output' => $estimateRequest->hasAudioOutput(),
            'input_media' => $estimateRequest->getInputMedia(),
            'reference_material' => $referenceMaterial,
            'topic_id' => $operation->getTopicId(),
            'task_id' => $operation->getTaskId(),
            'project_id' => $operation->getProjectId(),
            'original_model_id' => $operation->getModel(),
        ];
    }

    private function buildOperationUsageExecutionKey(VideoQueueOperationEntity $operation): string
    {
        return self::EXECUTION_KEY_VIDEO_PREFIX . $operation->getId();
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
        $referenceMaterial = $this->resolveVideoReferenceMaterialContext($dataIsolation, $operation);
        if ($usageTokens['completion_tokens'] !== null) {
            $businessParams['completion_tokens'] = $usageTokens['completion_tokens'];
        }
        if ($usageTokens['total_tokens'] !== null) {
            $businessParams['total_tokens'] = $usageTokens['total_tokens'];
        }
        if ($usageTokens['thought_tokens'] !== null) {
            $businessParams['thought_tokens'] = $usageTokens['thought_tokens'];
        }
        if ($usageTokens['billing_token_usage'] !== null) {
            $businessParams['billing_token_usage'] = $usageTokens['billing_token_usage'];
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
        $event->setHasAudioOutput($this->resolveHasAudioOutput($operation));
        $event->setProjectId($operation->getProjectId());
        $event->setVideoId($operation->getVideoId());
        $event->setGeneratedFileKey($this->buildStoredVideoFileKey($operation));
        $event->setTopicId($operation->getTopicId());
        $event->setTaskId($operation->getTaskId());
        $event->setSourceId($operation->getSourceId());
        $event->setSourceType($this->resolveSourceType($accessTokenEntity, $operation, $requestBusinessParams));
        $event->setCreatedAt(new DateTime());
        $event->setVideoReferenceMaterial($referenceMaterial);
        $event->setBusinessParams($businessParams);
        // 与 businessParams 中字段一致，便于 billing-manager 读事件对象直接扣费
        $event->setCompletionTokens($usageTokens['completion_tokens']);
        $event->setTotalTokens($usageTokens['total_tokens']);
        $event->setThoughtTokens($usageTokens['thought_tokens']);
        $event->setBillingTokenUsage($usageTokens['billing_token_usage']);

        AsyncEventUtil::dispatch($event);
        $this->dispatchOperationUsageFinished($operation, OperationUsageFinishedEvent::STATUS_SUCCESS);
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
            'has_audio_output' => $event->hasAudioOutput(),
            'project_id' => $event->getProjectId(),
            'video_id' => $event->getVideoId(),
            'topic_id' => $event->getTopicId(),
            'task_id' => $event->getTaskId(),
            'source_id' => $event->getSourceId(),
            'source_type' => $event->getSourceType()->value,
            'completion_tokens' => $event->getCompletionTokens(),
            'total_tokens' => $event->getTotalTokens(),
            'video_reference_material' => $event->getVideoReferenceMaterial(),
        ]);
    }

    private function resolveHasAudioOutput(VideoQueueOperationEntity $operation): bool
    {
        $providerCode = ProviderCode::tryFrom($operation->getProviderCode());
        if (! $providerCode instanceof ProviderCode) {
            return true;
        }

        return $this->videoGenerationConfigDomainService->resolveHasAudioOutput(
            $operation->getModelVersion(),
            $operation->getModel(),
            $providerCode,
            $operation->getRawRequest(),
        );
    }

    private function dispatchVideoGenerateFailedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        array $requestBusinessParams = [],
        ?ProviderVideoException $throwable = null
    ): void {
        $event = new VideoGenerateFailedEvent();
        $businessParams = $this->buildVideoAuditBusinessParams(
            $dataIsolation,
            $operation,
            $requestBusinessParams,
            self::AUDIT_STATUS_FAIL,
        );

        if ($throwable instanceof Throwable) {
            $previousExceptions = InvocationDetailInfo::extractPreviousExceptions($throwable);
            if ($previousExceptions !== []) {
                $businessParams['previous_exceptions'] = $previousExceptions;
            }
        }

        $event->setOrganizationCode($operation->getOrganizationCode());
        $event->setUserId($operation->getUserId());
        $event->setModel($operation->getModel());
        $event->setProviderModelId($operation->getProviderModelId());
        $event->setVideoId($operation->getVideoId());
        $event->setBusinessParams($businessParams);

        AsyncEventUtil::dispatch($event);
        $this->dispatchOperationUsageFinished($operation, OperationUsageFinishedEvent::STATUS_FAILED);
        $this->logger->info('VideoGenerateFailedEventDispatched', [
            'operation_id' => $operation->getId(),
            'organization_code' => $event->getOrganizationCode(),
            'user_id' => $event->getUserId(),
            'model' => $event->getModel(),
            'provider_model_id' => $event->getProviderModelId(),
            'video_id' => $event->getVideoId(),
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
        // 轮询触发审计时调用方不一定带 magic_topic_id，用 operation 里存的话题兜底
        if ($magicTopicId === '') {
            $magicTopicId = trim((string) ($operation->getTopicId() ?? ''));
        }
        $accessTokenName = (string) ($accessTokenEntity?->getName() ?? $requestBusinessParams['access_token_name'] ?? '');
        $accessTokenType = (string) ($accessTokenEntity?->getType()->value ?? $requestBusinessParams['access_token_type'] ?? '');
        $accessToken = (string) ($accessTokenEntity?->getAccessToken() ?? $requestBusinessParams['ak'] ?? '');
        $accessTokenId = $accessTokenEntity?->getId() ?? (int) ($requestBusinessParams['access_token_id'] ?? 0);
        $providerName = $operation->getAuditProviderName();

        $params = [
            'event_id' => (string) IdGenerator::getSnowId(),
            'operation_id' => $operation->getId(),
            'operation_usage_execution_key' => $this->buildOperationUsageExecutionKey($operation),
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
            'user_name' => $dataIsolation->getUserName() !== '' ? $dataIsolation->getUserName() : (string) ($requestBusinessParams['user_name'] ?? ''),
            'app_id' => $dataIsolation->getAppId() !== '' ? $dataIsolation->getAppId() : (string) ($requestBusinessParams['app_id'] ?? ''),
            'source_id' => $sourceId,
            'video_id' => (string) ($operation->getVideoId() ?? ''),
            'request_id' => $requestId,
            'magic_topic_id' => $magicTopicId,
            'ak' => $accessToken,
            'access_token_id' => $accessTokenId,
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
     * 按服务商解析视频任务回包中的 token 用量。
     *
     * @return array{completion_tokens: ?int, total_tokens: ?int, thought_tokens: int, billing_token_usage: ?array{input_tokens: int, output_text_tokens: int, output_video_tokens: int}}
     */
    private function resolveVideoProviderUsageTokens(VideoQueueOperationEntity $operation): array
    {
        $providerResult = $operation->getProviderResult();
        $usage = is_array($providerResult) ? ($providerResult['usage'] ?? null) : null;
        if (! is_array($usage)) {
            return ['completion_tokens' => null, 'total_tokens' => null, 'thought_tokens' => 0, 'billing_token_usage' => null];
        }

        if ($operation->getProviderCode() === ProviderCode::Gemini->value) {
            return $this->resolveGeminiVideoUsageTokens($usage);
        }

        return [
            'completion_tokens' => isset($usage['completion_tokens']) ? max(0, (int) $usage['completion_tokens']) : null,
            'total_tokens' => isset($usage['total_tokens']) ? max(0, (int) $usage['total_tokens']) : null,
            'thought_tokens' => 0,
            'billing_token_usage' => null,
        ];
    }

    /**
     * 解析 Gemini 视频模型的四类 token 用量。
     *
     * @param array<string, mixed> $usage
     * @return array{completion_tokens: int, total_tokens: int, thought_tokens: int, billing_token_usage: array{input_tokens: int, output_text_tokens: int, output_video_tokens: int}}
     */
    private function resolveGeminiVideoUsageTokens(array $usage): array
    {
        $modalityTokens = array_column($usage['output_tokens_by_modality'] ?? [], 'tokens', 'modality');
        $thoughtTokens = (int) ($usage['total_thought_tokens'] ?? 0);

        $billingTokenUsage = [
            'input_tokens' => (int) ($usage['total_input_tokens'] ?? 0),
            'output_text_tokens' => (int) ($modalityTokens['text'] ?? 0),
            'output_video_tokens' => (int) ($modalityTokens['video'] ?? 0),
        ];

        $completionTokens = isset($usage['total_output_tokens'])
            ? (int) $usage['total_output_tokens']
            : (int) ($usage['completion_tokens'] ?? (
                $billingTokenUsage['output_text_tokens']
                + $billingTokenUsage['output_video_tokens']
                + $thoughtTokens
            ));
        $totalTokens = isset($usage['total_tokens'])
            ? (int) $usage['total_tokens']
            : $billingTokenUsage['input_tokens'] + $completionTokens;

        return [
            'completion_tokens' => $completionTokens,
            'total_tokens' => $totalTokens,
            'thought_tokens' => $thoughtTokens,
            'billing_token_usage' => $billingTokenUsage,
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
        if ($output !== []) {
            $output['has_audio_output'] = $this->resolveHasAudioOutput($operation);
        }

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

        $result['provider_result'] = PayloadLogSanitizer::sanitizeValue(
            $this->stripProviderVideoBytes($providerResult),
        );
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
            $billingDetails = $this->videoBillingDetailsResolver->resolveFromMetadataWithFallback($resolvedProbeResult['metadata'], $operation);
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
        $tempPath = null;
        try {
            $tempPath = $this->downloadOperationMediaToLocalFile($operation->getId(), $url);
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
            if (is_string($tempPath)) {
                @unlink($tempPath);
            }
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

    private function resolveSourceType(
        ?AccessTokenEntity $accessTokenEntity,
        VideoQueueOperationEntity $operation,
        array $requestBusinessParams = []
    ): ImageGenerateSourceEnum {
        $accessTokenType = $accessTokenEntity?->getType()->value
            ?? (string) ($requestBusinessParams['access_token_type'] ?? '');
        if ($accessTokenType === AccessTokenType::User->value) {
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
     *     reference_audio_count: int,
     *     input_video_duration_seconds: int
     * }
     */
    private function resolveVideoReferenceMaterialContext(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation
    ): array {
        $raw = $operation->getRawRequest();
        $inputs = is_array($raw['inputs'] ?? null) ? $raw['inputs'] : [];
        $inputMode = isset($raw['input_mode']) ? trim((string) $raw['input_mode']) : '';

        $images = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $videos = is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : [];
        $audios = is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : [];
        $inputVideoDurationSeconds = 0;
        if ($videos !== []) {
            $metadata = $this->videoInputMediaMetadataResolver->resolve(
                $dataIsolation,
                $operation->getProjectId(),
                $videos,
            );
            $inputVideoDurationSeconds = (int) ($metadata['total_duration_seconds'] ?? 0);
        }

        return [
            'input_mode' => $inputMode === '' ? null : $inputMode,
            'reference_image_count' => count($images),
            'reference_video_count' => count($videos),
            'reference_audio_count' => count($audios),
            'input_video_duration_seconds' => $inputVideoDurationSeconds,
        ];
    }
}

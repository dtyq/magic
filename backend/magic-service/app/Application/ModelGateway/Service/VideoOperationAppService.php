<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ModelGateway\Contract\VideoMediaProbeInterface;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGenerateFailedEvent;
use App\Domain\ModelGateway\Service\QueueOperationExecutionDomainService;
use App\Domain\ModelGateway\Service\VideoBillingDetailsResolver;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Infrastructure\Util\StringMaskUtil;
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
    ) {
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
        $config = $this->queueOperationExecutionDomainService->getConfig($operation);
        try {
            $providerTaskId = $this->queueOperationExecutionDomainService->submit($operation, $config);
        } catch (ProviderVideoException $throwable) {
            $this->dispatchVideoGenerateFailedEvent(
                $dataIsolation,
                $operation,
                $accessToken,
                $requestDTO->getBusinessParams(),
            );
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, $throwable->getMessage(), throwable: $throwable);
        }
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
                $result = $this->normalizeExecutionResult(
                    $operation,
                    $this->queueOperationExecutionDomainService->query($operation, $config, $providerTaskId),
                );
                $probeResult = $this->extractProbeResult($result);
                $syncResult = $this->videoQueueDomainService->syncWithExecutionResult($operation, $providerTaskId, $result);
                if ($syncResult->isFirstSucceeded()) {
                    $this->dispatchVideoGeneratedEvent($dataIsolation, $operation, $probeResult, $accessToken, $businessParams);
                } elseif ($syncResult->isStatusChanged() && $syncResult->getStatus() === VideoOperationStatus::FAILED) {
                    $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $accessToken, $businessParams);
                }
                $this->videoQueueDomainService->saveOperation($operation);
            } catch (ProviderVideoException $throwable) {
                $this->videoQueueDomainService->finishExecutionFailure($operation, $throwable->getMessage());
                $this->dispatchVideoGenerateFailedEvent($dataIsolation, $operation, $accessToken, $businessParams);
                $this->videoQueueDomainService->saveOperation($operation);
            }
        }

        $response = $this->videoQueueDomainService->buildOperationResponse(
            $operation,
            $this->videoQueueDomainService->buildDirectQueueSnapshot(),
        );

        $response->setOutput($this->resolveResponseOutput($operation, $response->getOutput()));

        return $response;
    }

    /**
     * @param null|array{metadata: VideoMediaMetadata, source: string} $probeResult
     */
    private function dispatchVideoGeneratedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        ?array $probeResult = null,
        string $accessTokenRaw = '',
        array $requestBusinessParams = []
    ): void {
        $event = new VideoGeneratedEvent();
        $accessTokenEntity = $this->resolveAccessTokenEntity($dataIsolation);
        $billingDetails = $this->resolveBillingDetails($operation, $probeResult);
        $businessParams = $this->buildVideoAuditBusinessParams(
            $dataIsolation,
            $operation,
            $accessTokenRaw,
            $requestBusinessParams,
        );

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
        $event->setBusinessParams($businessParams);

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
        ]);
    }

    private function dispatchVideoGenerateFailedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        VideoQueueOperationEntity $operation,
        string $accessTokenRaw = '',
        array $requestBusinessParams = []
    ): void {
        $event = new VideoGenerateFailedEvent();
        $businessParams = $this->buildVideoAuditBusinessParams(
            $dataIsolation,
            $operation,
            $accessTokenRaw,
            $requestBusinessParams,
            'FAIL',
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
        string $accessTokenRaw = '',
        array $requestBusinessParams = [],
        string $outcome = 'SUCCESS'
    ): array {
        $accessTokenEntity = $this->resolveAccessTokenEntity($dataIsolation);
        $sourceId = (string) ($operation->getSourceId() ?: $dataIsolation->getSourceId());
        $requestId = trim((string) ($requestBusinessParams['request_id'] ?? ''));
        $magicTopicId = trim((string) ($requestBusinessParams['magic_topic_id'] ?? ''));
        $accessTokenName = (string) $accessTokenEntity?->getName();
        $accessTokenType = $accessTokenEntity === null ? '' : $accessTokenEntity->getType()->value;
        $providerName = $operation->getAuditProviderName();

        return [
            'event_id' => (string) IdGenerator::getSnowId(),
            'model_id' => $operation->getModel(),
            'model_version' => $operation->getModelVersion(),
            'provider_model_id' => $operation->getProviderModelId(),
            'provider_name' => $providerName,
            'original_model_id' => $operation->getModel(),
            'outcome' => $outcome,
            'operation_time' => $this->toTimestampMs($operation->getCreatedAt()),
            'response_duration' => $this->calculateLatencyMs($operation),
            'organization_id' => $operation->getOrganizationCode(),
            'user_id' => $operation->getUserId(),
            'user_name' => $dataIsolation->getUserName(),
            'app_id' => $dataIsolation->getAppId(),
            'source_id' => $sourceId,
            'request_id' => $requestId,
            'magic_topic_id' => $magicTopicId,
            'access_token_raw' => $accessTokenRaw,
            'ak' => StringMaskUtil::mask($accessTokenRaw),
            'access_token_name' => $accessTokenName,
            'access_token_type' => $accessTokenType,
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
        $safeUrl = SSRFUtil::getSafeUrl($url, replaceIp: false);
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
}

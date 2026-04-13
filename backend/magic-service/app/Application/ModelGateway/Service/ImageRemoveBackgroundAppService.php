<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Processor\ImageAssetMaterializer;
use App\Application\ModelGateway\Processor\ImageProcessorPipeline;
use App\Application\ModelGateway\Processor\UploadProcessor;
use App\Application\ModelGateway\Processor\WatermarkProcessor;
use App\Application\ModelGateway\Struct\ImagePostProcessOptions;
use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Domain\ModelGateway\Entity\Dto\ImageRemoveBackgroundRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Event\ImageRemoveBackgroundCompletedEvent;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverRequest;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Exception\ImageRemoveBackgroundDriverException;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverFactory;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverInterface;
use App\Infrastructure\ImageGenerate\WatermarkPolicyInterface;
use App\Infrastructure\Util\File\SecureImageDownloader;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Support\make;
use function Hyperf\Translation\__;

/**
 * 去背景应用服务。
 * 这里负责串起配置解析、输入下载、第三方调用、图片后处理和最终响应组装。
 */
class ImageRemoveBackgroundAppService extends AbstractLLMAppService
{
    #[Inject]
    protected ImageAssetMaterializer $imageAssetMaterializer;

    #[Inject]
    protected ImageProcessorPipeline $imageProcessorPipeline;

    #[Inject]
    protected ImageRemoveBackgroundDriverFactory $driverFactory;

    #[Inject]
    protected SecureImageDownloader $secureImageDownloader;

    #[Inject]
    protected EventDispatcherInterface $eventDispatcher;

    #[Inject]
    protected AiAbilityDomainService $aiAbilityDomainService;

    /**
     * 连通性测试入口，允许使用未保存的临时配置校验 provider 可用性。
     *
     * @param array<string, mixed> $config
     * @return array{success: bool, latency_ms: int, message: string}
     */
    public function testConnection(MagicUserAuthorization $authorization, array $config): array
    {
        $startedAt = microtime(true);
        /** @var TemporaryFileManager $temporaryFileManager */
        $temporaryFileManager = make(TemporaryFileManager::class);
        $uploadedTestFileKey = '';

        try {
            $providerConfig = $this->resolveEnabledProviderConfigFromRawConfig($config);
            $this->logger->info('ImageRemoveBackgroundTestConnectionStart', [
                'provider' => (string) ($providerConfig['provider'] ?? ''),
                'organization_code' => $authorization->getOrganizationCode(),
            ]);

            $driver = $this->driverFactory->create((string) $providerConfig['provider'], $providerConfig);
            $localTestImagePath = $this->createLocalTestImage();
            $temporaryFileManager->add($localTestImagePath);

            $sourceType = ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_FILE;
            $sourceValue = $localTestImagePath;
            $sourceMimeType = 'image/png';

            if ($driver->supportsDirectUrl()) {
                [$uploadedTestFileKey, $testImageUrl] = $this->uploadTestImageAndGetUrl($authorization, $localTestImagePath);
                $sourceType = ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_URL;
                $sourceValue = $testImageUrl;
                $sourceMimeType = null;
            }

            $driver->testConnection(new ImageRemoveBackgroundDriverRequest(
                $sourceType,
                $sourceValue,
                $sourceMimeType,
                'png',
            ));

            $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);
            $this->logger->info('ImageRemoveBackgroundTestConnectionSuccess', [
                'provider' => (string) ($providerConfig['provider'] ?? ''),
                'latency_ms' => $latencyMs,
            ]);

            return [
                'success' => true,
                'latency_ms' => $latencyMs,
                'message' => __('response.success'),
            ];
        } catch (ImageRemoveBackgroundDriverException $exception) {
            $this->logger->warning('ImageRemoveBackgroundTestConnectionProviderFail', [
                'error' => $exception->getMessage(),
                'provider' => $exception->getProvider(),
                'provider_error_code' => $exception->getProviderErrorCode(),
            ]);
            return [
                'success' => false,
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'message' => $exception->getMessage(),
            ];
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundTestConnectionException', [
                'error' => $throwable->getMessage(),
            ]);
            $message = $throwable->getMessage();
            if (str_contains($message, '.')) {
                $message = __($message);
            }

            return [
                'success' => false,
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'message' => $message,
            ];
        } finally {
            if ($uploadedTestFileKey !== '') {
                $this->fileDomainService->deleteFile($authorization->getOrganizationCode(), $uploadedTestFileKey, StorageBucketType::Public);
            }
            $temporaryFileManager->cleanup();
        }
    }

    /**
     * 执行去背景主流程。
     *
     * - 平台输入问题直接抛出异常
     * - 第三方 provider 失败则返回 OpenAI 风格错误结构
     * - provider 成功后统一进入“物化 -> 水印 -> 上传”处理链
     */
    public function removeBackground(ImageRemoveBackgroundRequestDTO $dto): OpenAIFormatResponse
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken($dto->getAccessToken(), $dto->getBusinessParams());

        $providerConfig = $this->resolveEnabledProviderConfig();
        $providerCode = (string) ($providerConfig['provider'] ?? '');
        $callTime = date('Y-m-d H:i:s');
        $startTime = microtime(true);

        $this->logger->info('ImageRemoveBackgroundStart', [
            'provider' => $providerCode,
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'image_count' => count($dto->getImages()),
            'image_url_host' => (string) (parse_url($dto->getImageUrl(), PHP_URL_HOST) ?: ''),
            'output_format' => $dto->getOutputFormat(),
        ]);

        $driver = $this->driverFactory->create($providerCode, $providerConfig);

        /** @var TemporaryFileManager $temporaryFileManager */
        $temporaryFileManager = make(TemporaryFileManager::class);

        try {
            $driverRequest = $this->buildDriverRequest($driver, $dto, $temporaryFileManager);

            $providerResult = $driver->removeBackground($driverRequest);

            $processingContext = $this->imageAssetMaterializer->materialize(
                $providerResult,
                $temporaryFileManager,
            );

            $this->hydrateProcessingContext($dataIsolation, $processingContext, $dto);

            $processedContext = $this->imageProcessorPipeline->process(
                $processingContext,
                [
                    WatermarkProcessor::class,
                    UploadProcessor::class,
                ],
            );
            $response = $this->buildSuccessResponse($processedContext);
            $responseData = $response->toArray();
            $responseTime = (int) round((microtime(true) - $startTime) * 1000);

            if ($response->isSuccess()) {
                $this->dispatchCompletedEvent($dataIsolation, $dto, $callTime, $responseTime);
            }

            $this->logger->info('ImageRemoveBackgroundSuccess', [
                'provider' => $providerCode,
                'mime_type' => (string) ($responseData['data'][0]['mime_type'] ?? ''),
                'result_url_host' => (string) (parse_url((string) ($responseData['data'][0]['url'] ?? ''), PHP_URL_HOST) ?: ''),
                'response_time' => $responseTime,
            ]);

            return $response;
        } catch (ImageRemoveBackgroundDriverException $exception) {
            $this->logger->warning('ImageRemoveBackgroundProviderFail', [
                'provider' => $exception->getProvider() ?: $providerCode,
                'provider_error_code' => $exception->getProviderErrorCode(),
                'provider_error_message' => $exception->getMessage(),
            ]);
            return $this->buildProviderErrorResponse($exception);
        } catch (InvalidArgumentException $exception) {
            $this->logger->warning('ImageRemoveBackgroundInvalidInput', [
                'provider' => $providerCode,
                'error' => $exception->getMessage(),
            ]);
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, $exception->getMessage());
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundException', [
                'provider' => $providerCode,
                'error' => $throwable->getMessage(),
            ]);
            throw $throwable;
        } finally {
            $temporaryFileManager->cleanup();
        }
    }

    private function hydrateProcessingContext(
        ModelGatewayDataIsolation $dataIsolation,
        ImageProcessContext $context,
        ImageRemoveBackgroundRequestDTO $dto,
    ): void {
        // 去背景当前仍复用通用图片处理链，因此在这里补齐上传路径和后处理配置。
        $context->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $context->setStorageSubDir('open/remove-background');
        $context->setUploadFileNamePrefix('remove_background');
        $context->setPostProcessOptions(
            $this->buildPostProcessOptions($dataIsolation, $dto)
        );
    }

    private function buildPostProcessOptions(
        ModelGatewayDataIsolation $dataIsolation,
        ImageRemoveBackgroundRequestDTO $dto,
    ): ImagePostProcessOptions {
        // 去背景不需要完整的 ImageGenerateRequest，这里只构造后处理真正关心的字段。
        $options = new ImagePostProcessOptions();
        $options->setOutputFormat($dto->getOutputFormat() ?? '');
        $watermarkConfig = $this->watermarkConfig->getWatermarkConfig(
            $dataIsolation->getCurrentOrganizationCode()
        );
        $options->setWatermarkConfig(
            $this->resolveWatermarkConfig($dataIsolation, $watermarkConfig)
        );

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setUserId($dataIsolation->getCurrentUserId())
            ->setAccessTokenId((string) $dataIsolation->getAccessToken()->getId());

        if (! empty($dto->getTopicId())) {
            $implicitWatermark->setTopicId((string) $dto->getTopicId());
        }

        $options->setImplicitWatermark($implicitWatermark);

        return $options;
    }

    private function resolveWatermarkConfig(
        ModelGatewayDataIsolation $dataIsolation,
        ?WatermarkConfig $watermarkConfig,
    ): ?WatermarkConfig {
        return di(WatermarkPolicyInterface::class)->apply(
            $dataIsolation->getAccessToken(),
            $watermarkConfig,
        );
    }

    private function buildSuccessResponse(ImageProcessContext $context): OpenAIFormatResponse
    {
        // 去背景接口对外仍保持现有 OpenAI 风格响应结构，便于上层无感迁移。
        return new OpenAIFormatResponse([
            'created' => time(),
            'data' => [
                [
                    'url' => $context->getUploadedUrl(),
                    'mime_type' => $context->getUploadedMimeType() !== ''
                        ? $context->getUploadedMimeType()
                        : $context->getMimeType(),
                ],
            ],
            'usage' => null,
            'provider' => $context->getProvider(),
        ]);
    }

    private function buildProviderErrorResponse(ImageRemoveBackgroundDriverException $exception): OpenAIFormatResponse
    {
        return new OpenAIFormatResponse([
            'created' => time(),
            'data' => [],
            'usage' => null,
            'provider_error_message' => $exception->getMessage(),
            'provider_error_code' => $exception->getProviderErrorCode(),
            'provider' => $exception->getProvider(),
        ]);
    }

    private function dispatchCompletedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        ImageRemoveBackgroundRequestDTO $dto,
        string $callTime,
        int $responseTime,
    ): void {
        $event = new ImageRemoveBackgroundCompletedEvent();
        $event->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $event->setUserId($dataIsolation->getCurrentUserId());
        $event->setImageCount(1);
        $event->setOriginalModelId($dto->getOriginalModelId());
        $event->setSourceType($this->resolveSourceType($dataIsolation, $dto));
        $event->setCallTime($callTime);
        $event->setResponseTime($responseTime);
        $event->setTopicId($dto->getTopicId());
        $event->setTaskId($dto->getTaskId());
        $event->setAccessTokenId($dataIsolation->getAccessToken()->getId());
        $event->setAccessTokenName($dataIsolation->getAccessToken()->getName());
        $event->setSourceId($dataIsolation->getSourceId());
        $event->setCreatedAt(new DateTime());

        $this->eventDispatcher->dispatch($event);
    }

    private function resolveSourceType(
        ModelGatewayDataIsolation $dataIsolation,
        ImageRemoveBackgroundRequestDTO $dto,
    ): ImageGenerateSourceEnum {
        if ($dataIsolation->getAccessToken()->getType()->isUser()) {
            return ImageGenerateSourceEnum::API_PLATFORM;
        }

        if (! empty($dto->getTopicId())) {
            return ImageGenerateSourceEnum::SUPER_MAGIC;
        }

        return ImageGenerateSourceEnum::API;
    }

    /**
     * 根据 driver 能力构造请求对象。
     * 是否消费 `output_format` 由具体 driver 自行决定，上层只负责透传用户意图。
     */
    private function buildDriverRequest(
        ImageRemoveBackgroundDriverInterface $driver,
        ImageRemoveBackgroundRequestDTO $dto,
        TemporaryFileManager $temporaryFileManager
    ): ImageRemoveBackgroundDriverRequest {
        $outputFormat = $dto->getOutputFormat();

        if ($driver->supportsDirectUrl()) {
            $safeUrl = SSRFUtil::getSafeUrl($dto->getImageUrl(), replaceIp: false);

            return new ImageRemoveBackgroundDriverRequest(
                ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_URL,
                $safeUrl,
                null,
                $outputFormat,
            );
        }

        $downloadedImage = $this->secureImageDownloader->download($dto->getImageUrl());
        $temporaryFileManager->add($downloadedImage->getValue());

        return new ImageRemoveBackgroundDriverRequest(
            ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_FILE,
            $downloadedImage->getValue(),
            $downloadedImage->getMimeType(),
            $outputFormat,
        );
    }

    /**
     * 从能力配置中获取当前启用的 provider。若未配置或未启用则直接按平台错误处理。
     *
     * @return array<string, mixed>
     */
    private function resolveEnabledProviderConfig(): array
    {
        $config = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::ImageRemoveBackground);
        return $this->resolveEnabledProviderConfigFromRawConfig($config);
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function resolveEnabledProviderConfigFromRawConfig(array $config): array
    {
        $providers = $config['providers'] ?? [];
        if (! is_array($providers) || $providers === []) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('image_generate.remove_background_provider_not_configured'));
        }

        foreach ($providers as $provider) {
            if (is_array($provider) && ($provider['enable'] ?? false) === true) {
                return $provider;
            }
        }

        ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('image_generate.remove_background_provider_not_configured'));
    }

    /**
     * 生成一张极小的 PNG 测试图，用于能力管理侧连通性测试。
     */
    private function createLocalTestImage(): string
    {
        try {
            $tempFile = TemporaryFileManager::createTempFile('remove_bg_test_');
        } catch (RuntimeException) {
            throw new InvalidArgumentException('image_generate.create_temp_file_failed');
        }

        $pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';
        $binary = base64_decode($pngBase64, true);
        if (! is_string($binary) || file_put_contents($tempFile, $binary) === false) {
            @unlink($tempFile);
            throw new InvalidArgumentException('image_generate.create_temp_file_failed');
        }

        return $tempFile;
    }

    /**
     * 对直传 URL 的 provider，先把测试图上传到当前环境 OSS，再把可访问链接交给 provider。
     *
     * @return array{0: string, 1: string}
     */
    private function uploadTestImageAndGetUrl(MagicUserAuthorization $authorization, string $localTestImagePath): array
    {
        $uploadFile = new UploadFile($localTestImagePath, 'open/remove-background-test');
        $this->fileDomainService->uploadByCredential(
            $authorization->getOrganizationCode(),
            $uploadFile,
            StorageBucketType::Public,
            true,
            'image/png'
        );

        $fileLink = $this->fileDomainService->getLink(
            $authorization->getOrganizationCode(),
            $uploadFile->getKey(),
            StorageBucketType::Public
        );
        if ($fileLink === null || $fileLink->getUrl() === '') {
            throw new InvalidArgumentException('image_generate.file_upload_failed');
        }

        return [$uploadFile->getKey(), $fileLink->getUrl()];
    }
}

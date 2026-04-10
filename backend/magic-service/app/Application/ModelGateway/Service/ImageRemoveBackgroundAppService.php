<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\DTO\ImageRemoveBackgroundResultDTO;
use App\Application\ModelGateway\DTO\ImageRemoveBackgroundTestResultDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageRemoveBackgroundRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\DTO\ImageRemoveBackgroundDriverRequest;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Exception\ImageRemoveBackgroundDriverException;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverFactory;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundDriverInterface;
use App\Infrastructure\Util\File\SecureImageDownloadTool;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\MimeTypes;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

use function Hyperf\Support\make;
use function Hyperf\Translation\__;

/**
 * 去背景应用服务，负责统一编排配置读取、输入资源处理、第三方调用和结果上传。
 */
class ImageRemoveBackgroundAppService extends ImageLLMAppService
{
    #[Inject]
    protected ImageRemoveBackgroundDriverFactory $driverFactory;

    #[Inject]
    protected SecureImageDownloadTool $secureImageDownloadTool;

    /**
     * 连通性测试入口，允许使用未保存的临时配置校验 provider 可用性。
     *
     * @param array<string, mixed> $config
     */
    public function testConnection(MagicUserAuthorization $authorization, array $config): ImageRemoveBackgroundTestResultDTO
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

            return new ImageRemoveBackgroundTestResultDTO([
                'success' => true,
                'latency_ms' => $latencyMs,
                'message' => __('response.success'),
            ]);
        } catch (ImageRemoveBackgroundDriverException $exception) {
            $this->logger->warning('ImageRemoveBackgroundTestConnectionProviderFail', [
                'error' => $exception->getMessage(),
                'provider' => $exception->getProvider(),
                'provider_error_code' => $exception->getProviderErrorCode(),
            ]);
            return new ImageRemoveBackgroundTestResultDTO([
                'success' => false,
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'message' => $exception->getMessage(),
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('ImageRemoveBackgroundTestConnectionException', [
                'error' => $throwable->getMessage(),
            ]);
            $message = $throwable->getMessage();
            if (str_contains($message, '.')) {
                $message = __($message);
            }

            return new ImageRemoveBackgroundTestResultDTO([
                'success' => false,
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'message' => $message,
            ]);
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
     */
    public function removeBackground(ImageRemoveBackgroundRequestDTO $dto): OpenAIFormatResponse
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken($dto->getAccessToken(), $dto->getBusinessParams());

        $providerConfig = $this->resolveEnabledProviderConfig();
        $providerCode = (string) ($providerConfig['provider'] ?? '');

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

            try {
                $driverResponse = $driver->removeBackground($driverRequest);
            } catch (ImageRemoveBackgroundDriverException $exception) {
                $this->logger->warning('ImageRemoveBackgroundProviderFail', [
                    'provider' => $exception->getProvider() ?: $providerCode,
                    'provider_error_code' => $exception->getProviderErrorCode(),
                    'provider_error_message' => $exception->getMessage(),
                ]);
                return $this->buildProviderErrorResponse($exception);
            }

            $temporaryFileManager->add($driverResponse->getResultFilePath());
            $result = $this->uploadResultFile(
                $dataIsolation,
                $driverResponse->getResultFilePath(),
                $driverResponse->getMimeType(),
                $providerCode
            );
            $response = $result->toOpenAIFormatResponse();
            $responseData = $response->toArray();

            $this->logger->info('ImageRemoveBackgroundSuccess', [
                'provider' => $providerCode,
                'mime_type' => $driverResponse->getMimeType(),
                'result_file_size' => is_file($driverResponse->getResultFilePath()) ? (filesize($driverResponse->getResultFilePath()) ?: 0) : 0,
                'result_url_host' => (string) (parse_url((string) ($responseData['data'][0]['url'] ?? ''), PHP_URL_HOST) ?: ''),
            ]);

            return $response;
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

        $downloadedImage = $this->secureImageDownloadTool->download($dto->getImageUrl());
        $temporaryFileManager->add($downloadedImage->getTempFilePath());

        return new ImageRemoveBackgroundDriverRequest(
            ImageRemoveBackgroundDriverRequest::SOURCE_TYPE_FILE,
            $downloadedImage->getTempFilePath(),
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
     * 第三方 provider 失败不进入平台异常响应，而是复用现有图片能力的 provider_error_* 结构。
     */
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

    /**
     * 将第三方结果图上传到当前环境 OSS，确保所有 provider 最终都返回当前环境的文件地址。
     */
    private function uploadResultFile(
        ModelGatewayDataIsolation $dataIsolation,
        string $resultFilePath,
        string $mimeType,
        string $providerCode = ''
    ): ImageRemoveBackgroundResultDTO {
        $uploadFile = new UploadFile(
            $resultFilePath,
            'open/remove-background',
            $this->buildUploadFileName($mimeType, $resultFilePath)
        );
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        $this->fileDomainService->uploadByCredential(
            $organizationCode,
            $uploadFile,
            StorageBucketType::Public,
            true,
            $mimeType
        );

        $fileLink = $this->fileDomainService->getLink($organizationCode, $uploadFile->getKey(), StorageBucketType::Public);
        if ($fileLink === null || $fileLink->getUrl() === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, __('image_generate.file_upload_failed', ['error' => 'result_url_missing']));
        }

        return new ImageRemoveBackgroundResultDTO([
            'url' => $fileLink->getUrl(),
            'mime_type' => $mimeType,
            'provider' => $providerCode,
        ]);
    }

    /**
     * 为上传结果图生成稳定的带后缀文件名，避免临时文件无扩展名导致 OSS URL 缺少后缀。
     */
    private function buildUploadFileName(string $mimeType, string $resultFilePath): string
    {
        $extension = MimeTypes::getExtension($mimeType);
        if ($extension === '') {
            $extension = pathinfo($resultFilePath, PATHINFO_EXTENSION);
        }
        if ($extension === '') {
            $extension = 'png';
        }

        return sprintf('remove_background_%s.%s', uniqid(), $extension);
    }

    /**
     * 生成一张极小的 PNG 测试图，用于能力管理侧连通性测试。
     */
    private function createLocalTestImage(): string
    {
        try {
            $tempFile = TemporaryFileManager::createRemoveBackgroundTempFile('remove_bg_test_');
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

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\ImageExpandRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Event\ImageOperationCompletedEvent;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageExpand\DTO\ImageExpandDriverRequest;
use App\Infrastructure\ExternalAPI\ImageExpand\Exception\ImageExpandDriverException;
use App\Infrastructure\ExternalAPI\ImageExpand\ImageExpandDriverFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\File\TemporaryFileManager;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\MimeTypes;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;
use Throwable;

use function Hyperf\Support\make;
use function Hyperf\Translation\__;

class ImageExpandAppService extends ImageLLMAppService
{
    private const PROVIDER_NOT_CONFIGURED = 'image_generate.image_expand_provider_not_configured';

    #[Inject]
    protected ImageExpandDriverFactory $driverFactory;

    public function expand(ImageExpandRequestDTO $dto): OpenAIFormatResponse
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken($dto->getAccessToken(), $dto->getBusinessParams());
        $providerConfig = $this->resolveEnabledProviderConfig();
        $providerCode = (string) ($providerConfig['provider'] ?? '');
        $callTime = date('Y-m-d H:i:s');
        $startTime = microtime(true);

        $temporaryFileManager = make(TemporaryFileManager::class);

        try {
            $imageInput = $this->createImageInput($dto->getImageUrl(), 'image_url');
            $maskInput = $this->createImageInput($dto->getMaskUrl(), 'mask_url');
            [$imageInput, $maskInput] = $this->normalizeMixedImageInputs($dataIsolation, $imageInput, $maskInput, 'open/image-expand/input');
            $driver = $this->driverFactory->create($providerCode, $providerConfig);

            $driverResponse = $driver->expand(new ImageExpandDriverRequest(
                $imageInput,
                $maskInput,
                $dto->getCustomPrompt(),
                $dto->getSteps(),
                $dto->getStrength(),
                $dto->getScale(),
                $dto->getSeed(),
                $dto->getTop(),
                $dto->getBottom(),
                $dto->getLeft(),
                $dto->getRight(),
                $dto->getMaxHeight(),
                $dto->getMaxWidth(),
            ));

            $temporaryFileManager->add($driverResponse->getResultFilePath());

            $response = $this->uploadResultFile($dataIsolation, $driverResponse->getResultFilePath(), $driverResponse->getMimeType(), $providerCode);
            $responseTime = (int) round((microtime(true) - $startTime) * 1000);
            if ($response->isSuccess()) {
                $this->dispatchImageOperationCompletedEvent(
                    $dataIsolation,
                    $dto,
                    ImageOperationCompletedEvent::OPERATION_EXPAND,
                    $providerCode,
                    $callTime,
                    $responseTime,
                    (int) round($startTime * 1000),
                    $response->getData(),
                );
            }

            return $response;
        } catch (ImageExpandDriverException $exception) {
            $this->logger->warning('ImageExpandProviderFail', [
                'provider' => $exception->getProvider() ?: $providerCode,
                'provider_error_code' => $exception->getProviderErrorCode(),
                'provider_error_message' => $exception->getMessage(),
            ]);
            return new OpenAIFormatResponse([
                'created' => time(),
                'data' => [],
                'usage' => null,
                'provider_error_message' => __('image_generate.image_operation_failed'),
                'provider_error_code' => $exception->getProviderErrorCode(),
                'provider' => $exception->getProvider(),
            ]);
        } catch (SSRFException $exception) {
            $this->logger->warning('ImageExpandUnsafeInputUrl', [
                'provider' => $providerCode,
                'error' => $exception->getMessage(),
            ]);
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, $exception->getMessage());
        } catch (InvalidArgumentException $exception) {
            $this->logger->warning('ImageExpandInvalidInput', [
                'provider' => $providerCode,
                'error' => $exception->getMessage(),
            ]);
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, $exception->getMessage());
        } catch (Throwable $throwable) {
            $this->logger->error('ImageExpandException', [
                'error' => $throwable->getMessage(),
                'provider' => $providerCode,
            ]);
            throw $throwable;
        } finally {
            $temporaryFileManager->cleanup();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveEnabledProviderConfig(): array
    {
        $config = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::ImageExpand);
        $providers = $config['providers'] ?? [];
        if (! is_array($providers)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, self::PROVIDER_NOT_CONFIGURED);
        }

        foreach ($providers as $provider) {
            if (is_array($provider) && ($provider['enable'] ?? false) === true) {
                return $provider;
            }
        }

        ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, self::PROVIDER_NOT_CONFIGURED);
    }

    private function uploadResultFile(
        ModelGatewayDataIsolation $dataIsolation,
        string $resultFilePath,
        string $mimeType,
        string $providerCode = ''
    ): OpenAIFormatResponse {
        $uploadFile = new UploadFile(
            $resultFilePath,
            'open/image-expand',
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
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'image_generate.file_upload_failed', ['error' => 'result_url_missing']);
        }

        return new OpenAIFormatResponse([
            'created' => time(),
            'data' => [
                [
                    'url' => $fileLink->getUrl(),
                    'mime_type' => $mimeType,
                ],
            ],
            'usage' => null,
            'provider' => $providerCode,
        ]);
    }

    private function buildUploadFileName(string $mimeType, string $resultFilePath): string
    {
        $extension = MimeTypes::getExtension($mimeType);
        if ($extension === '') {
            $extension = pathinfo($resultFilePath, PATHINFO_EXTENSION);
        }
        if ($extension === '') {
            $extension = 'png';
        }

        return sprintf('image_expand_%s.%s', uniqid(), $extension);
    }
}

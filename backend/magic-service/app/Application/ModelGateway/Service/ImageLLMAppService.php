<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ImageInput;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Service\ImageGenerationTaskDomainService;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Di\Annotation\Inject;
use InvalidArgumentException;
use Throwable;

use function Hyperf\Translation\__;

/**
 * Image-related LLM service.
 */
class ImageLLMAppService extends LLMAppService
{
    #[Inject]
    protected AiAbilityDomainService $aiAbilityDomainService;

    #[Inject]
    protected ImageGenerationTaskDomainService $imageGenerationTaskDomainService;

    public function submitGenerationTask(string $accessToken, TextGenerateImageDTO $requestDTO, array $requestPayload): array
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken(
            $accessToken,
            $requestDTO->getBusinessParams()
        );
        $task = $this->imageGenerationTaskDomainService->createTask($dataIsolation, $requestDTO, $requestPayload);
        $taskId = $task->getId();

        Coroutine::create(function () use ($taskId, $requestDTO): void {
            $this->executeGenerationTask($taskId, $requestDTO);
        });

        return $task->toResponseArray();
    }

    public function queryGenerationTask(string $accessToken, string $taskId, array $businessParams = []): array
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);
        $task = $this->imageGenerationTaskDomainService->getOwnedTask($dataIsolation, $taskId);
        $this->imageGenerationTaskDomainService->markTimedOutIfNeeded($task);

        return $task->toResponseArray();
    }

    /**
     * Image convert high definition V2 - API endpoint version.
     *
     * @throws SSRFException
     */
    public function imageConvertHighV2(ImageConvertHighDTO $imageConvertHighDTO): OpenAIFormatResponse
    {
        // Get model gateway data isolation from access token
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($imageConvertHighDTO->getAccessToken(), $imageConvertHighDTO->getBusinessParams());

        // Get model_id from AI ability config
        $config = $this->aiAbilityDomainService->getProviderConfig(AiAbilityCode::ImageConvertHigh);

        $modelId = $config['model_id'] ?? null;

        // Get default prompt from image_models config
        $defaultPrompt = config('image_models.default_convert_high_prompt', '');

        $prompt = $imageConvertHighDTO->getPrompt();
        $prompt = ! empty($prompt) ? $prompt : (! empty($config['prompt']) ? $config['prompt'] : $defaultPrompt);

        if (empty($modelId)) {
            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                __('image_generate.image_convert_high_model_not_configured')
            );
        }

        // Use image edit logic
        $response = $this->convertHighWithImageEdit((string) $modelId, $prompt, $imageConvertHighDTO, $modelGatewayDataIsolation);
        if ($response->hasError()) {
            $response->setProviderErrorMessage(__('image_generate.image_operation_failed'));
        }

        return $response;
    }

    protected function createImageInput(string $input, string $label): ImageInput
    {
        $imageInput = ImageInput::fromString($input);
        if ($imageInput === null) {
            throw new InvalidArgumentException(__('common.invalid_format', ['label' => $label]));
        }

        if ($imageInput->isUrl()) {
            return ImageInput::fromUrl(SSRFUtil::getSafeUrl($imageInput->getValue(), replaceIp: false));
        }

        return $imageInput;
    }

    /**
     * @return array{0: ImageInput, 1: ImageInput}
     */
    protected function normalizeMixedImageInputs(
        ModelGatewayDataIsolation $dataIsolation,
        ImageInput $imageInput,
        ImageInput $maskInput,
        string $subDir
    ): array {
        if ($imageInput->isBase64() === $maskInput->isBase64()) {
            return [$imageInput, $maskInput];
        }

        if ($imageInput->isBase64()) {
            $imageInput = $this->uploadBase64ImageInput($dataIsolation, $imageInput, $subDir);
        }
        if ($maskInput->isBase64()) {
            $maskInput = $this->uploadBase64ImageInput($dataIsolation, $maskInput, $subDir);
        }

        return [$imageInput, $maskInput];
    }

    /**
     * Use image edit logic to convert high definition.
     */
    private function convertHighWithImageEdit(
        string $modelId,
        string $prompt,
        ImageConvertHighDTO $imageConvertHighDTO,
        ModelGatewayDataIsolation $modelGatewayDataIsolation
    ): OpenAIFormatResponse {
        $images = $imageConvertHighDTO->getImages();
        if (empty($images)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('common.empty', ['label' => 'images_field']));
        }
        // In convert high scenario, only process the first image
        $url = $images[0];
        $url = SSRFUtil::getSafeUrl($url, replaceIp: false);

        // Get size and prompt, use default values if not provided
        $size = $imageConvertHighDTO->getSize() ?? '1024x1024';

        // Create TextGenerateImageDTO using image edit logic
        $textGenerateImageDTO = new TextGenerateImageDTO([
            'model' => $modelId,
            'images' => [$url],
            'prompt' => $prompt,
            'size' => $size,
            'n' => 1,
        ]);
        $textGenerateImageDTO->setAccessToken($imageConvertHighDTO->getAccessToken());
        $textGenerateImageDTO->setIps($imageConvertHighDTO->getIps());
        $textGenerateImageDTO->setBusinessParams($imageConvertHighDTO->getBusinessParams());

        // Call image edit logic
        $response = $this->textGenerateImageV2($textGenerateImageDTO);

        // Type assertion: textGenerateImageV2 actually returns OpenAIFormatResponse
        if (! $response instanceof OpenAIFormatResponse) {
            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                __('image_generate.invalid_response_type')
            );
        }

        return $response;
    }

    private function uploadBase64ImageInput(
        ModelGatewayDataIsolation $dataIsolation,
        ImageInput $imageInput,
        string $subDir
    ): ImageInput {
        $uploadFile = new UploadFile($imageInput->getValue(), $subDir, '');
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        $this->fileDomainService->uploadByCredential(
            $organizationCode,
            $uploadFile,
            StorageBucketType::Public,
            true,
            $imageInput->getMimeType()
        );

        $fileLink = $this->fileDomainService->getLink($organizationCode, $uploadFile->getKey(), StorageBucketType::Public);
        if ($fileLink === null || $fileLink->getUrl() === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'image_generate.file_upload_failed', ['error' => 'input_url_missing']);
        }

        return ImageInput::fromUrl($fileLink->getUrl());
    }

    private function executeGenerationTask(string $taskId, TextGenerateImageDTO $requestDTO): void
    {
        try {
            $response = $this->textGenerateImageV2($requestDTO);
            $task = $this->imageGenerationTaskDomainService->getOwnedTask(
                $this->createModelGatewayDataIsolationByAccessToken(
                    $requestDTO->getAccessToken(),
                    $requestDTO->getBusinessParams()
                ),
                $taskId
            );

            if (! $response instanceof OpenAIFormatResponse) {
                $this->imageGenerationTaskDomainService->finishFailed($task, 'IMAGE_GENERATION_INVALID_RESPONSE', 'image generation response is invalid');
                return;
            }

            if ($response->hasError()) {
                $this->imageGenerationTaskDomainService->finishFailed(
                    $task,
                    $response->getProviderErrorCode(),
                    $response->getProviderErrorMessage() ?? 'image generation failed'
                );
                return;
            }

            $this->imageGenerationTaskDomainService->finishSucceeded($task, $response->toArray());
        } catch (Throwable $throwable) {
            $this->logger->error('image generation task failed', [
                'task_id' => $taskId,
                'model' => $requestDTO->getModel(),
                'error' => $throwable->getMessage(),
            ]);
            try {
                $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken(
                    $requestDTO->getAccessToken(),
                    $requestDTO->getBusinessParams()
                );
                $task = $this->imageGenerationTaskDomainService->getOwnedTask($dataIsolation, $taskId);
                $this->imageGenerationTaskDomainService->finishFailed($task, $throwable->getCode(), $throwable->getMessage());
            } catch (Throwable $finishThrowable) {
                $this->logger->error('image generation task finish failed', [
                    'task_id' => $taskId,
                    'error' => $finishThrowable->getMessage(),
                ]);
            }
        }
    }
}

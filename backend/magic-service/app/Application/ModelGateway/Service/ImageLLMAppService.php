<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Hyperf\Di\Annotation\Inject;

use function Hyperf\Translation\__;

/**
 * Image-related LLM service.
 */
class ImageLLMAppService extends LLMAppService
{
    #[Inject]
    protected AiAbilityDomainService $aiAbilityDomainService;

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
        return $this->convertHighWithImageEdit((string) $modelId, $prompt, $imageConvertHighDTO, $modelGatewayDataIsolation);
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
}

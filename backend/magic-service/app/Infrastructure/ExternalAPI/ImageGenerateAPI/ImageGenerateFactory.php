<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\ErrorCode\ImageGenerateErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI\AzureOpenAIImageGenerateModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Flux\FluxModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\GoogleGeminiRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT\GPT4oModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Midjourney\MidjourneyModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Official\OfficialProxyModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter\OpenRouterModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen\QwenImageModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineImageGenerateV3Model;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk\VolcengineArkRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\FluxModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\GPT4oModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MidjourneyModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\OfficialProxyRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\OpenRouterRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\QwenImageModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\VolcengineModelRequest;
use InvalidArgumentException;

use function Hyperf\Translation\__;

class ImageGenerateFactory
{
    public static function create(ImageGenerateModelType $imageGenerateType, array $serviceProviderConfig): ImageGenerate
    {
        return match ($imageGenerateType) {
            ImageGenerateModelType::Official => new OfficialProxyModel($serviceProviderConfig),
            ImageGenerateModelType::Midjourney => new MidjourneyModel($serviceProviderConfig),
            ImageGenerateModelType::Volcengine => new VolcengineModel($serviceProviderConfig),
            ImageGenerateModelType::VolcengineImageGenerateV3 => new VolcengineImageGenerateV3Model($serviceProviderConfig),
            ImageGenerateModelType::Flux => new FluxModel($serviceProviderConfig),
            ImageGenerateModelType::MiracleVision => new MiracleVisionModel($serviceProviderConfig),
            ImageGenerateModelType::TTAPIGPT4o => new GPT4oModel($serviceProviderConfig),
            ImageGenerateModelType::QwenImage => new QwenImageModel($serviceProviderConfig),
            ImageGenerateModelType::GoogleGemini => new GoogleGeminiModel($serviceProviderConfig),
            ImageGenerateModelType::VolcengineArk => new VolcengineArkModel($serviceProviderConfig),
            ImageGenerateModelType::OpenRouter => new OpenRouterModel($serviceProviderConfig),
            ImageGenerateModelType::OpenAI => new AzureOpenAIImageGenerateModel($serviceProviderConfig),
            ImageGenerateModelType::AzureOpenAIImageGenerate => new AzureOpenAIImageGenerateModel($serviceProviderConfig),
            default => throw new InvalidArgumentException('not support ' . $imageGenerateType->value),
        };
    }

    public static function createRequestType(ImageGenerateModelType $imageGenerateType, string $modelVersion, ?string $modelId, array $data): ImageGenerateRequest
    {
        $request = match ($imageGenerateType) {
            ImageGenerateModelType::Official => self::createOfficialProxyRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::Volcengine => self::createVolcengineRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::VolcengineImageGenerateV3 => self::createVolcengineRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::Midjourney => self::createMidjourneyRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::Flux => self::createFluxRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::TTAPIGPT4o => self::createGPT4oRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::QwenImage => self::createQwenImageRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::GoogleGemini => self::createGoogleGeminiRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::VolcengineArk => self::createVolcengineArkRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::OpenRouter => self::createOpenRouterRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::OpenAI => self::createAzureOpenAIImageRequest($modelVersion, $modelId, $data),
            ImageGenerateModelType::AzureOpenAIImageGenerate => self::createAzureOpenAIImageRequest($modelVersion, $modelId, $data),
            default => throw new InvalidArgumentException('not support ' . $imageGenerateType->value),
        };

        self::ensureResolution($request);
        return $request;
    }

    private static function createOfficialProxyRequest(string $modelVersion, ?string $modelId, array $data): OfficialProxyRequest
    {
        $request = new OfficialProxyRequest([
            'prompt' => $data['user_prompt'] ?? '',
            'model' => $data['model'] ?? '',
            'n' => $data['generate_num'] ?? 1,
            'sequential_image_generation' => $data['sequential_image_generation'] ?? 'disabled',
            'size' => $data['size'] ?? '1024x1024',
            'images' => $data['reference_images'] ?? [],
        ]);

        $request->setSize((string) ($data['size'] ?? '1024x1024'));
        return $request;
    }

    private static function createGPT4oRequest(string $modelVersion, ?string $modelId, array $data): GPT4oModelRequest
    {
        $request = new GPT4oModelRequest();
        $request->setReferImages($data['reference_images']);
        $request->setPrompt($data['user_prompt']);
        return $request;
    }

    private static function createVolcengineRequest(string $modelVersion, ?string $modelId, array $data): VolcengineModelRequest
    {
        // 解析 size 参数为 width 和 height
        [$width, $height] = SizeManager::getSizeFromConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);

        $request = new VolcengineModelRequest(
            $width,
            $height,
            $data['user_prompt'],
            $data['negative_prompt'],
        );
        isset($data['generate_num']) && $request->setGenerateNum($data['generate_num']);
        $request->setUseSr((bool) $data['use_sr']);
        $request->setReferenceImage($data['reference_images']);
        $request->setModel($data['model']);
        $request->setOrganizationCode($data['organization_code'] ?? '');
        return $request;
    }

    private static function createMidjourneyRequest(string $modelVersion, ?string $modelId, array $data): MidjourneyModelRequest
    {
        $model = $data['model'];
        $mode = strtolower(explode('-', $model, limit: 2)[1] ?? 'fast');

        [$width, $height] = SizeManager::getSizeFromConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);

        // Midjourney 不使用宽高参数，只需要 prompt 和 mode，但是 Request 类继承需要这些参数
        $request = new MidjourneyModelRequest((string) $width, (string) $height, $data['user_prompt'], $data['negative_prompt']);
        $request->setModel($mode);

        // 从 size 计算宽高比
        $ratio = SizeManager::calculateRatio((int) $width, (int) $height);
        $request->setRatio($ratio);

        isset($data['generate_num']) && $request->setGenerateNum($data['generate_num']);
        return $request;
    }

    private static function createFluxRequest(string $modelVersion, ?string $modelId, array $data): FluxModelRequest
    {
        $model = $data['model'];
        if (! in_array($model, ImageGenerateModelType::getFluxModes())) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        $model = strtolower($model);

        // 解析 size 参数为 width 和 height，如果不在配置中则降级
        [$widthStr, $heightStr] = SizeManager::getSizeFromConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);
        $width = (int) $widthStr;
        $height = (int) $heightStr;

        // todo xhy 先兜底，因为整个文生图还没有闭环
        if (
            ! ($width === 1024 && $height === 1024)
            && ! ($width === 1024 && $height === 1792)
            && ! ($width === 1792 && $height === 1024)
        ) {
            $width = 1024;
            $height = 1024;
        }

        $request = new FluxModelRequest((string) $width, (string) $height, $data['user_prompt'], $data['negative_prompt']);
        $request->setModel($model);
        isset($data['generate_num']) && $request->setGenerateNum($data['generate_num']);
        return $request;
    }

    private static function createAzureOpenAIImageRequest(string $modelVersion, ?string $modelId, array $data): AzureOpenAIImageRequest
    {
        $size = (string) ($data['size'] ?? '1024x1024');

        // 解析 size 参数为 width 和 height
        [$width, $height] = SizeManager::getSizeFromConfig($size, $modelVersion, $modelId);
        $imageConfig = SizeManager::matchConfig($modelVersion, $modelId) ?? [];

        // 校验尺寸是否正确
        if (! SizeManager::isDivisibleBy16((int) $width, (int) $height)) {
            $sizeContent = $width . 'x' . $height;
            if ($sizeContent !== $size) {
                $sizeContent = sprintf('%s(%s)', $size, $sizeContent);
            }
            ExceptionBuilder::throw(
                ImageGenerateErrorCode::UNSUPPORTED_IMAGE_SIZE,
                'image_generate.azure_image_size_must_be_divisible_by_16',
                ['size' => $sizeContent]
            );
        }

        $request = new AzureOpenAIImageRequest((string) $width, (string) $height, $data['user_prompt'] ?? $data['prompt'] ?? '', '');
        $request->setSize($width . 'x' . $height);

        $imageGenerationConfig = $data['image_generation_config'] ?? [];
        if (is_array($imageGenerationConfig) && isset($imageGenerationConfig['quality'])) {
            $request->setQuality((string) $imageGenerationConfig['quality']);
        }

        if (isset($data['generate_num'])) {
            $request->setN((int) $data['generate_num']);
        } elseif (isset($data['n'])) {
            $request->setN((int) $data['n']);
        }

        $referenceImages = self::resolveReferenceImages($data, $imageConfig);
        if ($referenceImages !== null) {
            $request->setReferenceImages($referenceImages);
        }

        return $request;
    }

    private static function createQwenImageRequest(string $modelVersion, ?string $modelId, array $data): QwenImageModelRequest
    {
        $width = $height = '';
        if (! empty($data['size'])) {
            [$width, $height] = SizeManager::getSizeFromConfig($data['size'], $modelVersion, $modelId);
        }

        $request = new QwenImageModelRequest(
            $width,
            $height,
            $data['user_prompt'],
            $data['negative_prompt'] ?? '',
            $data['model'] ?? 'qwen-image'
        );

        if (isset($data['generate_num'])) {
            $request->setGenerateNum($data['generate_num']);
        }

        $request->setPromptExtend(true);
        $request->setWatermark(false);

        // 获取图片配置
        $imageConfig = SizeManager::matchConfig($modelVersion, $modelId);

        $referenceImages = self::resolveReferenceImages($data, $imageConfig, 3);
        if ($referenceImages !== null) {
            $request->setReferImages($referenceImages);
        }

        return $request;
    }

    private static function createGoogleGeminiRequest(string $modelVersion, ?string $modelId, array $data): GoogleGeminiRequest
    {
        // 解析 size 参数，获取完整配置 (width, height, ratio, scale)
        $sizeConfig = SizeManager::getSizeConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);
        $width = $sizeConfig['width'];
        $height = $sizeConfig['height'];
        $ratio = $sizeConfig['ratio'];
        $scale = $sizeConfig['scale'];

        // 获取图片配置
        $imageConfig = SizeManager::matchConfig($modelVersion, $modelId);

        $request = new GoogleGeminiRequest(
            (string) $width, // width - Google Gemini不使用
            (string) $height, // height - Google Gemini不使用
            $data['user_prompt'] ?? '',
            '', // negative_prompt - Google Gemini不使用
            $data['model'] ?? 'gemini-2.5-flash-image'
        );

        // 设置宽高比和尺寸
        $request->setRatio($ratio);
        $request->setResolution($scale);

        // 生成图片数量
        if (isset($data['generate_num'])) {
            $request->setGenerateNum($data['generate_num']);
        }

        // 引用图片
        $referenceImages = self::resolveReferenceImages($data, $imageConfig);
        if ($referenceImages !== null) {
            $request->setReferImages($referenceImages);
        }

        return $request;
    }

    private static function createVolcengineArkRequest(string $modelVersion, ?string $modelId, array $data): VolcengineArkRequest
    {
        // 解析 size 参数为 width 和 height
        [$width, $height] = SizeManager::getSizeFromConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);

        // 获取图片配置
        $imageConfig = SizeManager::matchConfig($modelVersion, $modelId);

        $request = new VolcengineArkRequest(
            $width,
            $height,
            $data['user_prompt'],
        );

        if (isset($data['generate_num'])) {
            $request->setGenerateNum($data['generate_num']);
        }

        $referenceImages = self::resolveReferenceImages($data, $imageConfig);
        if ($referenceImages !== null) {
            $request->setReferImages($referenceImages);
        }

        if (isset($data['model'])) {
            $request->setModel($data['model']);
        }

        if (isset($data['response_format'])) {
            $request->setResponseFormat($data['response_format']);
        }

        // 处理组图功能参数
        if (isset($data['sequential_image_generation'])) {
            $request->setSequentialImageGeneration($data['sequential_image_generation']);
        }

        // 处理图片生成附加配置；当前火山组图选项仍复用这一映射。
        if (isset($data['image_generation_config']) && is_array($data['image_generation_config'])) {
            $request->setSequentialImageGenerationOptions($data['image_generation_config']);
        }

        // 处理输出图片格式：根据模型配置校验并解析
        if (! empty($data['output_format']) && ! empty($imageConfig['supported_output_formats'])) {
            $resolvedFormat = ImageOutputFormatConverter::resolveForModel($data['output_format'], $imageConfig);
            $request->setOutputFormat($resolvedFormat);
        }

        return $request;
    }

    private static function createOpenRouterRequest(string $modelVersion, ?string $modelId, array $data): OpenRouterRequest
    {
        $sizeConfig = SizeManager::getSizeConfig($data['size'] ?? '1024x1024', $modelVersion, $modelId);
        $width = $sizeConfig['width'];
        $height = $sizeConfig['height'];
        $ratio = $sizeConfig['ratio'];
        $scale = $sizeConfig['scale'];

        $imageConfig = [
            'aspect_ratio' => $ratio,
            'image_size' => $scale,
        ];

        $request = new OpenRouterRequest(
            (string) $width,
            (string) $height,
            $data['model'] ?? $modelVersion,
            $data['user_prompt'] ?? '',
            $imageConfig
        );

        $request->setRatio($ratio);
        $request->setResolution($scale);

        if (isset($data['generate_num'])) {
            $request->setGenerateNum((int) $data['generate_num']);
        }

        // 处理参考图片（用于图片编辑）
        $referenceImages = self::resolveReferenceImages($data, null, PHP_INT_MAX);
        if ($referenceImages !== null) {
            $request->setReferenceImages($referenceImages);
        }

        return $request;
    }

    private static function resolveReferenceImages(array $data, ?array $imageConfig, int $defaultMaxLimit = 14): ?array
    {
        if (! isset($data['reference_images'])) {
            return null;
        }

        $referenceImages = is_array($data['reference_images']) ? $data['reference_images'] : [$data['reference_images']];
        self::assertReferenceImagesLimit($referenceImages, $imageConfig, $defaultMaxLimit);
        return $referenceImages;
    }

    private static function assertReferenceImagesLimit(array $referenceImages, ?array $imageConfig, int $defaultMaxLimit): void
    {
        $maxLimit = $imageConfig['max_reference_images'] ?? $defaultMaxLimit;
        if (count($referenceImages) > $maxLimit) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, __('image_generate.too_many_reference_images_limit', ['limit' => $maxLimit]));
        }
    }

    /**
     * 仅为未显式设置 resolution 的请求补充分辨率，用于事件计费等内部链路兜底。
     */
    private static function ensureResolution(ImageGenerateRequest $request): void
    {
        if (! empty($request->getResolution())) {
            return;
        }

        if ($request->getWidth() !== '' && $request->getHeight() !== '') {
            $request->setResolution(
                SizeManager::resolveResolutionByPixels((int) $request->getWidth(), (int) $request->getHeight())
            );
            return;
        }

        $size = trim($request->getSize());
        if ($size !== '') {
            [$width, $height] = SizeManager::parseToWidthHeight($size);
            $request->setResolution(SizeManager::resolveResolutionByPixels((int) $width, (int) $height));
        }
    }
}

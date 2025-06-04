<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfig;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Flux\FluxModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT\GPT4oModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Midjourney\MidjourneyModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineImageGenerateV3Model;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\FluxModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\GPT4oModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MidjourneyModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\VolcengineModelRequest;
use InvalidArgumentException;

class ImageGenerateFactory
{
    public static function create(ImageGenerateModelType $imageGenerateType, ServiceProviderConfig $serviceProviderConfig): ImageGenerate
    {
        return match ($imageGenerateType) {
            ImageGenerateModelType::Midjourney => new MidjourneyModel($serviceProviderConfig),
            ImageGenerateModelType::Volcengine => new VolcengineModel($serviceProviderConfig),
            ImageGenerateModelType::VolcengineImageGenerateV3 => new VolcengineImageGenerateV3Model($serviceProviderConfig),
            ImageGenerateModelType::Flux => new FluxModel($serviceProviderConfig),
            ImageGenerateModelType::MiracleVision => new MiracleVisionModel($serviceProviderConfig),
            ImageGenerateModelType::TTAPIGPT4o => new GPT4oModel($serviceProviderConfig),
            default => throw new InvalidArgumentException('not support ' . $imageGenerateType->value),
        };
    }

    public static function createRequestType(ImageGenerateModelType $imageGenerateType, array $data): ImageGenerateRequest
    {
        return match ($imageGenerateType) {
            ImageGenerateModelType::Volcengine => self::createVolcengineRequest($data),
            ImageGenerateModelType::VolcengineImageGenerateV3 => self::createVolcengineRequest($data),
            ImageGenerateModelType::Midjourney => self::createMidjourneyRequest($data),
            ImageGenerateModelType::Flux => self::createFluxRequest($data),
            ImageGenerateModelType::TTAPIGPT4o => self::createGPT4oRequest($data),
            default => throw new InvalidArgumentException('not support ' . $imageGenerateType->value),
        };
    }

    private static function createGPT4oRequest(array $data): GPT4oModelRequest
    {
        $request = new GPT4oModelRequest();
        $request->setReferImages($data['reference_images']);
        $request->setPrompt($data['user_prompt']);
        return $request;
    }

    private static function createVolcengineRequest(array $data): VolcengineModelRequest
    {
        $request = new VolcengineModelRequest(
            (string) $data['width'],
            (string) $data['height'],
            $data['user_prompt'],
            $data['negative_prompt'],
        );
        isset($data['generate_num']) && $request->setGenerateNum($data['generate_num']);
        $request->setUseSr((bool) $data['use_sr']);
        $request->setReferenceImage($data['reference_images']);
        $request->setModel($data['model']);
        return $request;
    }

    private static function createMidjourneyRequest(array $data): MidjourneyModelRequest
    {
        $model = $data['model'];
        $mode = strtolower(explode('-', $model, limit: 2)[1] ?? 'fast');
        $request = new MidjourneyModelRequest($data['width'], $data['height'], $data['user_prompt'], $data['negative_prompt']);
        $request->setModel($mode);
        $request->setRatio($data['ratio']);
        isset($data['generate_num']) && $request->setGenerateNum($data['generate_num']);
        return $request;
    }

    private static function createFluxRequest(array $data): FluxModelRequest
    {
        $model = $data['model'];
        if (! in_array($model, ImageGenerateModelType::getFluxModes())) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        $model = strtolower($model);

        $width = (int) $data['width'];
        $height = (int) $data['height'];

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
        $request->setWidth((string) $width);
        $request->setHeight((string) $height);
        return $request;
    }
}

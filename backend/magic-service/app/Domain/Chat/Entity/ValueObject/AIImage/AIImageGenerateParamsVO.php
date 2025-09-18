<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\AIImage;

use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;

/**
 * AI文生图请求参数.
 */
class AIImageGenerateParamsVO extends AbstractValueObject
{
    public string $model;

    public string $height = '1024';

    public string $width = '1024';

    public string $ratio = '1:1';

    public bool $useSr = true;

    public string $userPrompt;

    public string $negativePrompt = '';

    public array $referenceImages = [];

    public int $generateNum = 4;

    public ImageGenerateSourceEnum $sourceType;

    public string $sourceId;

    public string $sequentialImageGeneration = 'disabled';

    public array $sequentialImageGenerationOptions = [];

    public function __construct()
    {
        $this->model = ImageGenerateModelType::Volcengine->value;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): AIImageGenerateParamsVO
    {
        $this->model = $model;
        return $this;
    }

    public function getRatio(): string
    {
        return $this->ratio;
    }

    public function setRatio(string $ratio): AIImageGenerateParamsVO
    {
        $this->ratio = $ratio;
        return $this;
    }

    /**
     * 将不支持的比例设置为推荐比例.
     * @return $this
     */
    public function setRatioForModel(string $ratio, ImageGenerateModelType $model): AIImageGenerateParamsVO
    {
        // Flux不支持的尺寸比例，将比例设置为推荐比例
        if ($model === ImageGenerateModelType::Flux) {
            $ratio = match ($ratio) {
                Radio::TwoToThree->value, Radio::ThreeToFour->value => Radio::NineToSixteen->value,
                Radio::ThreeToTwo->value, Radio::FourToThree->value => Radio::SixteenToNine->value,
                default => $ratio,
            };
        }
        $this->ratio = $ratio;
        return $this;
    }

    public function isUseSr(): bool
    {
        return $this->useSr;
    }

    public function setUseSr(bool $useSr): AIImageGenerateParamsVO
    {
        $this->useSr = $useSr;
        return $this;
    }

    public function getUserPrompt(): string
    {
        return $this->userPrompt;
    }

    public function setUserPrompt(string $userPrompt): AIImageGenerateParamsVO
    {
        $this->userPrompt = $userPrompt;
        return $this;
    }

    public function getHeight(): string
    {
        return $this->height;
    }

    public function setHeight(string $height): AIImageGenerateParamsVO
    {
        $this->height = $height;
        return $this;
    }

    public function getWidth(): string
    {
        return $this->width;
    }

    public function setWidth(string $width): AIImageGenerateParamsVO
    {
        $this->width = $width;
        return $this;
    }

    public function getNegativePrompt(): string
    {
        return $this->negativePrompt;
    }

    public function setNegativePrompt(string $negativePrompt): AIImageGenerateParamsVO
    {
        $this->negativePrompt = $negativePrompt;
        return $this;
    }

    public function getReferenceImages(): array
    {
        return $this->referenceImages;
    }

    public function setReferenceImages(array $referenceImages): AIImageGenerateParamsVO
    {
        $this->referenceImages = $referenceImages;
        return $this;
    }

    public function getGenerateNum(): int
    {
        return $this->generateNum;
    }

    public function setGenerateNum(int $generateNum): AIImageGenerateParamsVO
    {
        $this->generateNum = $generateNum;
        return $this;
    }

    public function setSizeFromRadioAndModel(string $radio, ImageGenerateModelType $modelType = ImageGenerateModelType::Volcengine): AIImageGenerateParamsVO
    {
        // 火山 尺寸映射
        $volcengineRadioSizeMap = [
            Radio::OneToOne->value => ['width' => '768', 'height' => '768'],
            Radio::TwoToThree->value => ['width' => '512', 'height' => '768'],
            Radio::ThreeToFour->value => ['width' => '576', 'height' => '768'],
            Radio::NineToSixteen->value => ['width' => '432', 'height' => '768'],
            Radio::ThreeToTwo->value => ['width' => '768', 'height' => '512'],
            Radio::FourToThree->value => ['width' => '768', 'height' => '576'],
            Radio::SixteenToNine->value => ['width' => '768', 'height' => '432'],
        ];
        // flux 尺寸映射
        $fluxRadioSizeMap = [
            Radio::OneToOne->value => ['width' => '1024', 'height' => '1024'],
            Radio::NineToSixteen->value => ['width' => '1024', 'height' => '1792'],
            Radio::SixteenToNine->value => ['width' => '1792', 'height' => '1024'],
        ];
        $radioSizeMap = match ($modelType) {
            ImageGenerateModelType::Flux => $fluxRadioSizeMap,
            default => $volcengineRadioSizeMap,
        };
        $size = $radioSizeMap[$radio] ?? $radioSizeMap[Radio::OneToOne->value];
        $this->setWidth($size['width']);
        $this->setHeight($size['height']);
        return $this;
    }

    public function getSourceType(): ImageGenerateSourceEnum
    {
        return $this->sourceType;
    }

    public function setSourceType(ImageGenerateSourceEnum $sourceType): void
    {
        $this->sourceType = $sourceType;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getSequentialImageGeneration(): string
    {
        return $this->sequentialImageGeneration;
    }

    public function setSequentialImageGeneration(string $sequentialImageGeneration): void
    {
        $this->sequentialImageGeneration = $sequentialImageGeneration;
    }

    public function getSequentialImageGenerationOptions(): array
    {
        return $this->sequentialImageGenerationOptions;
    }

    public function setSequentialImageGenerationOptions(array $sequentialImageGenerationOptions): void
    {
        $this->sequentialImageGenerationOptions = $sequentialImageGenerationOptions;
    }
}

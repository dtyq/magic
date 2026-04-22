<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;

/**
 * 对物化后的本地图片执行显式水印和隐式水印处理。
 * 只有上下文中声明了后处理配置且确实需要水印时才会触发。
 */
final class WatermarkProcessor implements ImageProcessorInterface
{
    public function __construct(
        private readonly ImageWatermarkProcessor $imageWatermarkProcessor,
    ) {
    }

    public function process(ImageProcessContext $context): void
    {
        $options = $context->getPostProcessOptions();
        if ($options === null) {
            return;
        }

        if (! $options->needsWatermarkProcessing()) {
            return;
        }

        $this->imageWatermarkProcessor->processLocalFile(
            $context->getLocalFilePath(),
            $options->getWatermarkConfig(),
            $options->getImplicitWatermark(),
        );
    }
}

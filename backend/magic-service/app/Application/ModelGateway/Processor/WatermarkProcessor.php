<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;

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

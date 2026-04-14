<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration;

use App\Application\Design\Tool\ImageGeneration\Contract\DesignImageGenerationTaskHandlerInterface;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignEraserImageTaskHandler;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignExpandImageTaskHandler;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignImageToImageTaskHandler;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignRemoveBackgroundImageTaskHandler;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignTextImageGenerationTaskHandler;
use App\Application\Design\Tool\ImageGeneration\Handler\DesignUpscaleImageTaskHandler;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;

readonly class DesignImageGenerationTaskHandlerFactory
{
    public static function get(ImageGenerationType $type): ?DesignImageGenerationTaskHandlerInterface
    {
        return match ($type) {
            ImageGenerationType::UPSCALE => di(DesignUpscaleImageTaskHandler::class),
            ImageGenerationType::REMOVE_BACKGROUND => di(DesignRemoveBackgroundImageTaskHandler::class),
            ImageGenerationType::ERASER => di(DesignEraserImageTaskHandler::class),
            ImageGenerationType::EXPAND => di(DesignExpandImageTaskHandler::class),
            ImageGenerationType::TEXT_TO_IMAGE => di(DesignTextImageGenerationTaskHandler::class),
            ImageGenerationType::IMAGE_TO_IMAGE => di(DesignImageToImageTaskHandler::class),
            default => null,
        };
    }
}

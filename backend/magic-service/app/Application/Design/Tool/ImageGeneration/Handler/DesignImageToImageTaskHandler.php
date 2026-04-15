<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「图生图」异步任务：与 {@see DesignTextImageGenerationTaskHandler} 共用同一套模型调用与参考图拼接逻辑；图生图必须带参考图。
 */
final class DesignImageToImageTaskHandler extends DesignTextImageGenerationTaskHandler
{
    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse {
        $referenceImages = $entity->getReferenceImages() ?? [];
        if ($referenceImages === []) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'design.image_generation.image_to_image_reference_required');
        }

        return parent::handle($dataIsolation, $entity, $workspacePrefix);
    }
}

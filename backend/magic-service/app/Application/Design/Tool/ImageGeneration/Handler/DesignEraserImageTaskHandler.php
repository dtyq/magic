<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;

/**
 * 设计侧「橡皮擦」：原图 + 标记图，参考图含 design-mark 私有桶与工作区 SandBox，走 textGenerateImageV2；配置 prompt 为空时使用内置默认英文说明.
 */
final class DesignEraserImageTaskHandler extends DesignTextImageGenerationTaskHandler
{
    /** 配置中 prompt 为空时使用：两图说明与擦除约束 */
    private const string DEFAULT_PROMPT = 'You are given two images. '
        . 'The first image is the original photo. '
        . 'The second image is a black-and-white mask where the white region indicates the area to be erased. '
        . 'Your task: remove the content inside the white masked area from the original photo, '
        . 'and fill that area with a realistic, seamless background inferred from the surrounding pixels. '
        . 'The result should look natural, as if the erased object was never there. '
        . 'Do not alter any part of the image outside the white masked region.';

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_erased_\d{14}$/', '_erased_');
    }

    protected function collectReferenceImageUrls(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): array {
        return $this->collectEraserExpandReferenceImageUrls($dataIsolation, $entity, $workspacePrefix);
    }

    protected function resolvePromptForGeneration(ImageGenerationEntity $entity): string
    {
        $configured = parent::resolvePromptForGeneration($entity);

        return $configured !== '' ? $configured : self::DEFAULT_PROMPT;
    }
}

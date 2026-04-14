<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;

/**
 * 设计侧「扩图」：扩展画布 + mask 等参考图，含 design-mark 与工作区 SandBox，走 textGenerateImageV2；配置 prompt 为空时使用内置默认英文说明.
 */
final class DesignExpandImageTaskHandler extends DesignTextImageGenerationTaskHandler
{
    /** 配置中 prompt 为空时使用：与原图 → 扩展画布 → mask → 成图 的产品逻辑一致（白=生成区，黑=原图 footprint 须保留） */
    private const string DEFAULT_PROMPT = 'You are given three images for one outpainting task. '
        . 'The first image is the original photo (content and style reference). '
        . 'The second image is the expanded canvas: the original photo is embedded at the same relative position as in the first image; the rest of the canvas is a solid placeholder (black or white) marking where new pixels must be synthesized. '
        . 'The third image is a binary mask aligned in size and layout with the second image: white pixels mark outpainting regions to generate; black pixels mark the original-photo footprint that must stay identical to the corresponding region on the expanded canvas (and consistent with the first image there). '
        . 'Your task: output one image with the same outer dimensions as the second image. Inpaint only where the mask is white: extend the scene realistically so style, lighting, perspective, and context match the original. Leave every black-mask pixel unchanged (preserve the original footprint on the canvas).';

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_expanded_\d{14}$/', '_expanded_');
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

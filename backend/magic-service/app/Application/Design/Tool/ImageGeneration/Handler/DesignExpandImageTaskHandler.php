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
    /**
     * 中文版提示词（仅供理解参考，实际使用英文版）：
     * 你会收到三张图片。
     * 第一张是原始照片。
     * 第二张是扩展后的画布，原始图像保持在原始位置，周围扩展区域用白色填充。
     * 第三张是黑白蒙版，白色区域标记需要生成内容的扩展部分。
     * 你的任务：以原始照片为参考，用真实自然的内容填充扩展画布中的白色蒙版区域，使其与原图无缝衔接。
     * 生成的内容应在风格、光线、透视和场景上与原图保持一致。
     * 不得对白色蒙版区域以外的任何部分进行修改。
     */
    private const string DEFAULT_PROMPT = 'You are given three images. '
        . 'The first image is the original photo. '
        . 'The second image is an expanded canvas where the original image is placed at its original position and the surrounding extended areas are filled with white. '
        . 'The third image is a black-and-white mask where the white region marks the extended areas to be generated. '
        . 'Your task: use the original photo as reference, and fill the white masked areas in the expanded canvas with realistic, natural content that seamlessly extends the original image. '
        . 'The generated content should be coherent with the style, lighting, perspective, and context of the original image. '
        . 'Do not alter any part of the image outside the white masked region.';

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

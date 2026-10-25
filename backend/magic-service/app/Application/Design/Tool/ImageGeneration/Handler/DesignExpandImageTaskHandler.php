<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\ImageExpandAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageExpandRequestDTO;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「扩图」.
 *
 * 中文版提示词（仅供理解参考，实际使用英文版）：
 * 你会收到三张图片。
 * 第一张是原始照片。
 * 第二张是扩展后的画布，原始图像保持在原始位置，周围扩展区域用白色填充。
 * 第三张是黑白蒙版，白色区域标记需要生成内容的扩展部分。
 * 你的任务：以原始照片为参考，用真实自然的内容填充扩展画布中的白色蒙版区域，使其与原图无缝衔接。
 * 生成的内容应在风格、光线、透视和场景上与原图保持一致。
 * 不得对白色蒙版区域以外的任何部分进行修改。
 *
 * 当前实现说明：
 * Design 任务仍按原语义保留三张 reference images：原图、扩展画布、mask。
 * 原图用于任务元数据、结果命名和语义追踪；扩展画布已经包含原图及其所在位置。
 * 底层 ImageExpand 能力当前统一为 image_url + mask_url 两个输入，因此实际调用模型网关时传入扩展画布和 mask。
 */
final class DesignExpandImageTaskHandler extends AbstractDesignImageGenerationTaskHandler
{
    public function __construct(
        FileDomainService $fileDomainService,
        TaskFileDomainService $taskFileDomainService,
        private readonly ImageExpandAppService $imageExpandAppService,
    ) {
        parent::__construct($fileDomainService, $taskFileDomainService);
    }

    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse {
        $referenceImages = $entity->getReferenceImages() ?? [];
        $canvasPath = $referenceImages[1] ?? null;
        $maskPath = $referenceImages[2] ?? null;
        if (! $canvasPath || ! $maskPath) {
            return null;
        }

        $inputUrls = $this->resolveEraserExpandProviderInputUrls(
            $dataIsolation,
            $entity,
            $canvasPath,
            $maskPath,
        );
        if ($inputUrls === null) {
            return null;
        }
        [$canvasUrl, $maskUrl] = $inputUrls;

        $dto = new ImageExpandRequestDTO([
            'image_url' => $canvasUrl,
            'mask_url' => $maskUrl,
            'custom_prompt' => trim((string) ($entity->getPrompt() ?? '')),
            'generate_config' => $entity->getImageGenerationConfig() ?? [],
        ]);
        $this->applyMagicAccessToken($dto);
        $dto->setBusinessParams($this->designImageGenerationBusinessParams($dataIsolation, $entity->getProjectId()));
        $dto->valid();

        return $this->narrowToOpenAiFormatImageResponse($this->imageExpandAppService->expand($dto));
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_expanded_\d{14}$/', '_expanded_');
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\ImageEraserAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageEraserRequestDTO;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「橡皮擦」.
 *
 * 给你两张图。
 * 第一张是原始照片。
 * 第二张是黑白 mask，白色区域表示要擦除的区域。
 * 你的任务：从原始照片中移除白 mask 区域内的内容，
 * 并用从周围像素推断出的逼真、无缝的背景填充该区域。
 * 结果应看起来自然，仿佛被擦除的物体从未出现过。
 * 不得改动白 mask 区域以外的图像任何部分。
 *
 * 当前实现说明：
 * Design 任务保留两张 reference images：原图、标记图。
 * 原图来自工作区 SandBox；design-mark 标记图来自 Private 私有桶。
 * 底层 ImageEraser 能力统一为 image_url + mask_url 两个输入，因此实际调用模型网关时传入原图和 mask。
 */
final class DesignEraserImageTaskHandler extends AbstractDesignImageGenerationTaskHandler
{
    public function __construct(
        FileDomainService $fileDomainService,
        TaskFileDomainService $taskFileDomainService,
        private readonly ImageEraserAppService $imageEraserAppService,
    ) {
        parent::__construct($fileDomainService, $taskFileDomainService);
    }

    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse {
        $referenceImages = $entity->getReferenceImages() ?? [];
        $imagePath = $referenceImages[0] ?? null;
        $maskPath = $referenceImages[1] ?? null;
        if (! $imagePath || ! $maskPath) {
            return null;
        }

        $inputUrls = $this->resolveEraserExpandProviderInputUrls(
            $dataIsolation,
            $entity,
            $imagePath,
            $maskPath,
        );
        if ($inputUrls === null) {
            return null;
        }
        [$imageUrl, $maskUrl] = $inputUrls;

        $dto = new ImageEraserRequestDTO([
            'image_url' => $imageUrl,
            'mask_url' => $maskUrl,
            'generate_config' => $entity->getImageGenerationConfig() ?? [],
        ]);
        $this->applyMagicAccessToken($dto);
        $dto->setBusinessParams($this->designImageGenerationBusinessParams($dataIsolation, $entity->getProjectId()));
        $dto->valid();

        return $this->narrowToOpenAiFormatImageResponse($this->imageEraserAppService->erase($dto));
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_erased_\d{14}$/', '_erased_');
    }
}

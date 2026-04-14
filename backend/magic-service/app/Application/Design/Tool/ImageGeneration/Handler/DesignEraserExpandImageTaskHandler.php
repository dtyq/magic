<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「橡皮擦 / 扩图」异步任务：多参考图（含 design-mark 私有桶与 SandBox 工作区图、crop），走文生图/图生图统一接口 textGenerateImageV2，并按类型规则化输出文件名。
 */
final class DesignEraserExpandImageTaskHandler extends AbstractDesignImageGenerationTaskHandler
{
    public function __construct(
        FileDomainService $fileDomainService,
        private readonly LLMAppService $llmAppService,
    ) {
        parent::__construct($fileDomainService);
    }

    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse {
        $dto = new TextGenerateImageDTO();
        $this->applyMagicAccessToken($dto);
        $dto->setModel($entity->getModelId());
        $dto->setBusinessParams($this->designImageGenerationBusinessParams($dataIsolation));
        $dto->setPrompt($entity->getPrompt());
        $dto->setN(1);

        $imageUrls = $this->collectEraserExpandReferenceImageUrls($dataIsolation, $entity, $workspacePrefix);
        if ($imageUrls !== []) {
            $dto->setImages($imageUrls);
        }
        if ($entity->getSize()) {
            $dto->setSize($entity->getSize());
        }

        return $this->narrowToOpenAiFormatImageResponse($this->llmAppService->textGenerateImageV2($dto));
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return match ($entity->getType()) {
            ImageGenerationType::ERASER => $this->outputBasenameFromFirstReferenceImage($entity, '/_erased_\d{14}$/', '_erased_'),
            ImageGenerationType::EXPAND => $this->outputBasenameFromFirstReferenceImage($entity, '/_expanded_\d{14}$/', '_expanded_'),
            default => null,
        };
    }
}

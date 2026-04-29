<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「文生图 / 图生图统一入口」异步任务：按实体中的 model 与 prompt，拼接参考图 URL，调用 textGenerateImageV2；输出文件名由 Tool 按 prompt/Agent 生成（本类默认不提供规则名）。
 *
 * 子类可覆盖 {@see self::collectReferenceImageUrls}、{@see self::resolvePromptForGeneration} 以区分参考图来源或默认提示词（如橡皮擦、扩图）。
 * 专用图生图链路见 {@see DesignImageToImageTaskHandler}。
 */
class DesignTextImageGenerationTaskHandler extends AbstractDesignImageGenerationTaskHandler
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
        $dto->setPrompt($this->resolvePromptForGeneration($entity));
        $dto->setN(1);

        $imageUrls = $this->collectReferenceImageUrls($dataIsolation, $entity, $workspacePrefix);
        if ($imageUrls !== []) {
            $dto->setImages($imageUrls);
        }
        if ($entity->getSize()) {
            $dto->setSize($entity->getSize());
        }

        return $this->narrowToOpenAiFormatImageResponse($this->llmAppService->textGenerateImageV2($dto));
    }

    /**
     * 默认：仅工作区 SandBox 参考图（支持 crop）；橡皮擦/扩图需含 design-mark 时子类覆盖.
     *
     * @return list<string>
     */
    protected function collectReferenceImageUrls(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): array {
        return $this->collectWorkspaceReferenceImageUrls($dataIsolation, $entity, $workspacePrefix);
    }

    /**
     * 默认：使用实体上的 prompt（trim）；子类可在配置为空时补默认英文提示词.
     */
    protected function resolvePromptForGeneration(ImageGenerationEntity $entity): string
    {
        return trim((string) ($entity->getPrompt() ?? ''));
    }
}

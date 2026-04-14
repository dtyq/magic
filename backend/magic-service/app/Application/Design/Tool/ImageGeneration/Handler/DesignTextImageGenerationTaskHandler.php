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
 * 设计侧「文生图」异步任务：按实体中的 model 与 prompt，拼接 SandBox 参考图 URL（支持 crop），调用 textGenerateImageV2；输出文件名由 Tool 按 prompt/Agent 生成（本类不提供规则名）。
 *
 * 图生图见 {@see DesignImageToImageTaskHandler}，当前共用实现，便于以后按类型拆分差异。
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
        $dto->setPrompt($entity->getPrompt());
        $dto->setN(1);

        $imageUrls = $this->collectWorkspaceReferenceImageUrls($dataIsolation, $entity, $workspacePrefix);
        if ($imageUrls !== []) {
            $dto->setImages($imageUrls);
        }
        if ($entity->getSize()) {
            $dto->setSize($entity->getSize());
        }

        return $this->narrowToOpenAiFormatImageResponse($this->llmAppService->textGenerateImageV2($dto));
    }
}

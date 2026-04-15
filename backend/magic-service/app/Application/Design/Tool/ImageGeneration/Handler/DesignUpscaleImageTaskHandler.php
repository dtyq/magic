<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\ImageLLMAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「转高清」异步任务：取工作区首张参考图，走 Model Gateway 转高清能力（imageConvertHighV2），并参与规则化输出文件名。
 */
final class DesignUpscaleImageTaskHandler extends AbstractDesignImageGenerationTaskHandler
{
    public function __construct(
        FileDomainService $fileDomainService,
        private readonly ImageLLMAppService $imageLLMAppService,
    ) {
        parent::__construct($fileDomainService);
    }

    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse {
        $referenceImage = $entity->getReferenceImages()[0] ?? null;
        if (! $referenceImage) {
            return null;
        }

        $linkOptions = $this->buildLinkOptionsFromImageOptions($entity->getReferenceImageOptions()[$referenceImage] ?? []);
        $imageUrl = $this->getWorkspaceSandboxImageUrl($dataIsolation, $workspacePrefix, $referenceImage, $linkOptions);
        if ($imageUrl === null || $imageUrl === '') {
            return null;
        }

        $dto = new ImageConvertHighDTO();
        $this->applyMagicAccessToken($dto);
        $dto->setBusinessParams($this->designImageGenerationBusinessParams($dataIsolation));
        $dto->setImages([$imageUrl]);

        return $this->narrowToOpenAiFormatImageResponse($this->imageLLMAppService->imageConvertHighV2($dto));
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_high_\d{14}$/', '_high_');
    }
}

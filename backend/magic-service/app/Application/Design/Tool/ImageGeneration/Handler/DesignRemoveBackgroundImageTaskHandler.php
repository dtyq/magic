<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Handler;

use App\Application\ModelGateway\Service\ImageRemoveBackgroundAppService;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\ImageRemoveBackgroundRequestDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧「去背景」异步任务：取工作区首张参考图，走专用去背景服务（removeBackground，PNG 透明底），并参与规则化输出文件名。
 */
final class DesignRemoveBackgroundImageTaskHandler extends AbstractDesignImageGenerationTaskHandler
{
    public function __construct(
        FileDomainService $fileDomainService,
        private readonly ImageRemoveBackgroundAppService $imageRemoveBackgroundAppService,
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

        $linkOptions = $this->buildLinkOptionsFromImageOptions($this->findImageOptions($entity->getReferenceImageOptions() ?? [], $referenceImage));
        $imageUrl = $this->getWorkspaceSandboxImageUrl($dataIsolation, $workspacePrefix, $referenceImage, $linkOptions);
        if ($imageUrl === null || $imageUrl === '') {
            return null;
        }

        $dto = new ImageRemoveBackgroundRequestDTO([
            'images' => [$imageUrl],
            'output_format' => 'webp',
        ]);
        $this->applyMagicAccessToken($dto);
        $dto->setBusinessParams($this->designImageGenerationBusinessParams($dataIsolation));
        // 通过画布模式-去背景，默认不加水印
        $dto->closeVisibleWatermark();
        $dto->valid();

        return $this->narrowToOpenAiFormatImageResponse($this->imageRemoveBackgroundAppService->removeBackground($dto));
    }

    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string
    {
        return $this->outputBasenameFromFirstReferenceImage($entity, '/_no_bg_\d{14}$/', '_no_bg_');
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\ImageRemoveBackgroundAppService;
use App\Domain\ModelGateway\Entity\Dto\ImageRemoveBackgroundRequestDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use Hyperf\Di\Annotation\Inject;

/**
 * 图片操作代理接口，承载去背景、扩图、橡皮擦等图片能力的统一入口。
 */
class ImageProxyApi extends AbstractOpenApi
{
    #[Inject]
    protected ImageRemoveBackgroundAppService $imageRemoveBackgroundAppService;

    /**
     * 去背景接口，返回与现有图片生成接口一致的 OpenAI 风格响应结构。
     */
    public function imageRemoveBackground(): array
    {
        $dto = new ImageRemoveBackgroundRequestDTO($this->request->all());
        $dto->setAccessToken($this->getAccessToken());
        $dto->setIps($this->getClientIps());
        $dto->valid();

        $this->enrichRequestDTO($dto, $this->request->getHeaders());

        $response = $this->imageRemoveBackgroundAppService->removeBackground($dto);
        if ($response instanceof OpenAIFormatResponse) {
            return $response->toArray();
        }

        return [];
    }
}

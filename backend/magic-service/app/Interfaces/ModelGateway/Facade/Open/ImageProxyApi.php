<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\ImageLLMAppService;
use App\Application\ModelGateway\Service\ImageRemoveBackgroundAppService;
use App\Domain\ModelGateway\Entity\Dto\ImageConvertHighDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageRemoveBackgroundRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 图片操作代理接口，承载去背景、扩图、橡皮擦等图片能力的统一入口。
 */
class ImageProxyApi extends AbstractOpenApi
{
    #[Inject]
    protected ImageRemoveBackgroundAppService $imageRemoveBackgroundAppService;

    #[Inject]
    protected ImageLLMAppService $imageLLMAppService;

    /**
     * 高清化接口.
     */
    public function imageConvertHigh(RequestInterface $request): array
    {
        $requestData = $request->all();

        $dto = new ImageConvertHighDTO($requestData);
        $dto->setAccessToken($this->getAccessToken());
        $dto->setIps($this->getClientIps());
        $dto->valid();

        $this->enrichRequestDTO($dto, $request->getHeaders());

        $response = $this->imageLLMAppService->imageConvertHighV2($dto);
        return $response->toArray();
    }

    /**
     * 去背景接口.
     */
    public function imageRemoveBackground(): array
    {
        $dto = new ImageRemoveBackgroundRequestDTO($this->request->all());
        $dto->setAccessToken($this->getAccessToken());
        $dto->setIps($this->getClientIps());
        // 默认开启水印，后续需要支持可以注释掉
        $dto->closeVisibleWatermark();
        $dto->valid();

        $this->enrichRequestDTO($dto, $this->request->getHeaders());

        $response = $this->imageRemoveBackgroundAppService->removeBackground($dto);

        return $response->toArray();
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Open;

use App\Application\ModelGateway\Service\VideoOperationAppService;
use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

class VideoApi extends AbstractOpenApi
{
    #[Inject]
    protected VideoOperationAppService $videoOperationAppService;

    /**
     * @throws Throwable
     */
    public function create(RequestInterface $request): array
    {
        $dto = new CreateVideoDTO($request->all());
        $dto->setAccessToken($this->getAccessToken());
        $dto->setIps($this->getClientIps());
        $this->enrichRequestDTO($dto, $request->getHeaders());
        $dto->valid();

        return $this->videoOperationAppService->enqueue($dto->getAccessToken(), $dto)->toArray();
    }

    public function get(string $id): array
    {
        return $this->videoOperationAppService->getOperation($this->getAccessToken(), $id, $this->getBusinessParams())->toArray();
    }
}

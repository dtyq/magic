<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Common\Facade;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Interfaces\Common\DTO\Request\BatchGenerateIdRequestDTO;
use Dtyq\SuperMagic\Interfaces\Common\DTO\Response\BatchGenerateIdResponseDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class CommonApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
    ) {
    }

    /**
     * 批量生成雪花ID.
     */
    public function batchGenerateId(): array
    {
        $requestDTO = BatchGenerateIdRequestDTO::fromRequest($this->request);

        $responseDTO = new BatchGenerateIdResponseDTO();
        for ($i = 0; $i < $requestDTO->getCount(); ++$i) {
            $responseDTO->ids[] = (string) IdGenerator::getSnowId();
        }

        return $responseDTO->toArray();
    }
}

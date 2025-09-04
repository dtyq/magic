<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileVersionAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class FileApi extends AbstractApi
{
    public function __construct(
        private readonly FileVersionAppService $fileVersionAppService,
        protected RequestInterface $request,
    ) {
        parent::__construct($request);
    }

    /**
     * 创建文件版本.
     *
     * @return array 创建结果
     */
    public function createFileVersion(): array
    {
        $requestDTO = CreateFileVersionRequestDTO::fromRequest($this->request);

        $responseDTO = $this->fileVersionAppService->createFileVersion($requestDTO);

        return $responseDTO->toArray();
    }
}

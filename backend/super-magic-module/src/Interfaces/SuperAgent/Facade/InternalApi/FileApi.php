<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi;

use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileManagementAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileVersionAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileTreeRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ScanWavFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class FileApi extends AbstractApi
{
    public function __construct(
        private readonly FileVersionAppService $fileVersionAppService,
        private readonly FileManagementAppService $fileManagementAppService,
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

        return $this->fileVersionAppService->createFileVersion($requestDTO)->toArray();
    }

    /**
     * 获取文件树.
     *
     * @return array 文件树结构
     */
    public function getFileTree(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = GetFileTreeRequestDTO::fromRequest($this->request);

        return $this->fileManagementAppService->getFileTree($requestContext, $requestDTO)->toArray();
    }

    /**
     * Scan object storage directory for .wav files and persist any new ones.
     *
     * @return array Scan result summary
     */
    public function scanWavFiles(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = ScanWavFilesRequestDTO::fromRequest($this->request);

        return $this->fileManagementAppService->scanWavFiles($requestContext, $requestDTO);
    }
}

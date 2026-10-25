<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\Facade\InternalApi;

use App\Application\SuperMagic\File\Service\FileManagementAppService;
use App\Application\SuperMagic\File\Service\FileVersionAppService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\File\DTO\Request\CreateFileVersionRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetFileTreeRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\ScanWavFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UpdateFileSourceRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
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
     * 获取文件最新版本号.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 文件ID
     * @return array 最新版本号
     */
    public function getLatestFileVersion(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        return $this->fileVersionAppService->getLatestFileVersion($requestContext, (int) $id)->toArray();
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

    /**
     * Update the source of a task file.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array Updated file info
     */
    public function updateFileSource(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = UpdateFileSourceRequestDTO::fromRequest($this->request);

        return $this->fileManagementAppService->updateFileSource($requestContext, $requestDTO);
    }
}

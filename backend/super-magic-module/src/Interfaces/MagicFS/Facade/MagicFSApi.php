<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\MagicFS\Service\MagicFSFileAppService;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\GetFileTreeRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\GetFileVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\ListFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request\UpdateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class MagicFSApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected MagicFSFileAppService $magicFSFileAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 列出目录内容
     * POST /api/v1/files/queries.
     */
    public function listFiles(): array
    {
        // 解析请求
        $requestDTO = ListFilesRequestDTO::fromRequest($this->request);

        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->listFiles($requestDTO);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 获取文件信息
     * POST /api/v1/files/{id}/queries.
     */
    public function getFileInfo(string $id): array
    {
        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->getFileInfo($id);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 获取单个文件版本号
     * GET /api/v1/open-api/magicfs/files/{id}/version.
     */
    public function getFileVersion(string $id): array
    {
        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->getFileVersion($id);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 批量获取文件版本号
     * POST /api/v1/open-api/magicfs/files/versions.
     */
    public function getFileVersions(): array
    {
        // 解析请求
        $requestDTO = GetFileVersionsRequestDTO::fromRequest($this->request);

        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->getFileVersions($requestDTO);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 创建文件或目录
     * POST /api/v1/files.
     */
    public function createFile(): array
    {
        // 解析请求
        $requestDTO = CreateFileRequestDTO::fromRequest($this->request);

        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->createFile($requestDTO);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 更新文件元数据
     * PUT /api/v1/files/{id}.
     */
    public function updateFile(string $id): array
    {
        // 解析请求
        $requestDTO = UpdateFileRequestDTO::fromRequest($this->request);

        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->updateFile($id, $requestDTO);

        // 返回结果
        return $responseDTO->toArray();
    }

    /**
     * 删除文件或目录
     * DELETE /api/v1/files/{id}.
     */
    public function deleteFile(string $id): array
    {
        // 调用应用服务
        $this->magicFSFileAppService->deleteFile($id);

        // 返回空结果（只返回 code 和 message，data 为空）
        return [];
    }

    /**
     * 获取文件树
     * POST /api/v1/open-api/magicfs/files/{id}/tree.
     */
    public function getFileTree(string $id): array
    {
        // 解析请求
        $requestDTO = GetFileTreeRequestDTO::fromRequest($this->request);

        // 调用应用服务
        $responseDTO = $this->magicFSFileAppService->getFileTree($id, $requestDTO);

        // 返回结果
        return $responseDTO->toArray();
    }
}

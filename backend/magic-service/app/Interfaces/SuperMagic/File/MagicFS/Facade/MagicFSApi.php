<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\Facade;

use App\Application\SuperMagic\File\FileScope\FileScopeHandlerResolver;
use App\Application\SuperMagic\File\Service\MagicFSFileAppService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\CreateFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesBatchRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileVersionsRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListChildrenPageRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListFilesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\RenameFileRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\UpdateFileRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class MagicFSApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected MagicFSFileAppService $magicFSFileAppService,
        protected FileScopeHandlerResolver $fileScopeHandlerResolver,
    ) {
        parent::__construct($request);
    }

    /**
     * 列出目录内容
     * POST /api/v1/files/queries.
     */
    public function listFiles(): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = ListFilesRequestDTO::fromRequest($this->request);

        if ($requestDTO->hasScope()) {
            $responseDTO = $this->fileScopeHandlerResolver
                ->resolve($requestDTO->scope)
                ->listFiles($authorization, $requestDTO);

            return $responseDTO->toArray();
        }

        $responseDTO = $this->magicFSFileAppService->listFiles($authorization, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * List one bounded page of direct children.
     * POST /api/v1/open-api/magicfs/files/{id}/children.
     */
    public function listChildrenPage(string $id): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = ListChildrenPageRequestDTO::fromRequest($this->request, $id);

        return $this->magicFSFileAppService
            ->listChildrenPage($authorization, $id, $requestDTO)
            ->toArray();
    }

    /**
     * 获取文件信息
     * POST /api/v1/files/{id}/queries.
     */
    public function getFileInfo(string $id): array
    {
        $authorization = $this->getCurrentUser();

        $responseDTO = $this->magicFSFileAppService->getFileInfo($authorization, $id);

        return $responseDTO->toArray();
    }

    /**
     * 获取单个文件版本号
     * GET /api/v1/open-api/magicfs/files/{id}/version.
     */
    public function getFileVersion(string $id): array
    {
        $authorization = $this->getCurrentUser();

        $responseDTO = $this->magicFSFileAppService->getFileVersion($authorization, $id);

        return $responseDTO->toArray();
    }

    /**
     * 获取挂载文件树的精准变更。
     * GET /api/v1/open-api/magicfs/files/{id}/changes.
     */
    public function getFileTreeChanges(string $id): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = GetFileTreeChangesRequestDTO::fromRequest($this->request);

        return $this->magicFSFileAppService
            ->getFileTreeChanges($authorization, $id, $requestDTO)
            ->toArray();
    }

    /**
     * 批量获取多个文件树的精准变更（推送不可用时的合并轮询入口）。
     * POST /api/v1/open-api/magicfs/changes/batch.
     */
    public function getFileTreeChangesBatch(): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = GetFileTreeChangesBatchRequestDTO::fromRequest($this->request);

        return $this->magicFSFileAppService->getFileTreeChangesBatch($authorization, $requestDTO);
    }

    /**
     * 根据项目 ID 获取项目根目录 file_id.
     * GET /api/v1/open-api/magicfs/projects/{projectId}/root-file-id.
     */
    public function getProjectRootFileId(string $projectId): array
    {
        $authorization = $this->getCurrentUser();

        return $this->magicFSFileAppService->getProjectRootFileId($authorization, $projectId);
    }

    /**
     * 批量获取文件版本号
     * POST /api/v1/open-api/magicfs/files/versions.
     */
    public function getFileVersions(): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = GetFileVersionsRequestDTO::fromRequest($this->request);

        $responseDTO = $this->magicFSFileAppService->getFileVersions($authorization, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 创建文件或目录
     * POST /api/v1/files.
     */
    public function createFile(): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = CreateFileRequestDTO::fromRequest($this->request);

        $responseDTO = $this->magicFSFileAppService->createFile($authorization, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 更新文件元数据
     * PUT /api/v1/files/{id}.
     */
    public function updateFile(string $id): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = UpdateFileRequestDTO::fromRequest($this->request);

        $responseDTO = $this->magicFSFileAppService->updateFile($authorization, $id, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * Rename a file onto a destination, with an explicit collision policy.
     *
     * POST /api/v1/open-api/magicfs/files/{id}/rename.
     *
     * Separate from updateFile because a rename carries an identity decision
     * ("whose row survives when the name is taken?") that a partial update
     * cannot express.
     */
    public function renameFile(string $id): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = RenameFileRequestDTO::fromRequest($this->request);

        return $this->magicFSFileAppService
            ->renameFile($authorization, $id, $requestDTO)
            ->toArray();
    }

    /**
     * 删除文件或目录
     * DELETE /api/v1/files/{id}.
     */
    public function deleteFile(string $id): array
    {
        $authorization = $this->getCurrentUser();

        $this->magicFSFileAppService->deleteFile($authorization, $id);

        return [];
    }

    /**
     * 获取文件树
     * POST /api/v1/open-api/magicfs/files/{id}/tree.
     */
    public function getFileTree(string $id): array
    {
        $authorization = $this->getCurrentUser();
        $requestDTO = GetFileTreeRequestDTO::fromRequest($this->request);

        $responseDTO = $this->magicFSFileAppService->getFileTree($authorization, $id, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 写权限预检（无副作用）。
     *
     * 与 updateFile 复用同一套 assertFileAccessible(fileId, EDITOR) 鉴权逻辑，
     * 仅校验不写状态。供 magicfs 客户端在写 S3 / 本地缓存之前确认当前用户
     * 具备写权限，避免"先写 S3 再被元数据服务拒绝"导致的数据不一致。
     *
     * POST /api/v1/open-api/magicfs/files/{id}/check-access.
     */
    public function checkFileAccess(string $id): array
    {
        $authorization = $this->getCurrentUser();

        $this->magicFSFileAppService->checkFileWriteAccess($authorization, $id);

        return [];
    }

    /**
     * 从协程上下文取出当前请求用户。
     *
     * SandboxUserAuthMiddleware 在「无 user 上下文」分支会放行而不注入用户，
     * 这里收口为强制要求：拿不到 user 抛 ACCOUNT_ERROR，避免下游接口在无身份场景下越权。
     */
    private function getCurrentUser(): MagicUserAuthorization
    {
        /* @var MagicUserAuthorization $authorization */
        return $this->getAuthorization();
    }
}

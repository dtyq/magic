<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\FileScope;

use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\File\Service\FileMemoryAccessService;
use App\Application\SuperMagic\File\Service\FileReferenceAppService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\FileReferenceSelectorDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceStatus;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListFilesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\ListFilesResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\MagicFSFileDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;

/** 当前组织、当前用户的登记文件空间；浏览只发现用户根，不创建记忆目录或正文。 */
final class UserFileScopeHandler implements FileScopeHandlerInterface
{
    public const string SCOPE = 'user';

    public function __construct(
        private readonly TaskFileDomainService $files,
        private readonly MagicFSFileDomainService $magicFS,
        private readonly FileMemoryAccessService $ownership,
        private readonly FileReferenceAppService $references,
        private readonly FileScopeTreeService $treeService,
        private readonly FileAppService $fileAppService,
    ) {
    }

    public function listFiles(
        MagicUserAuthorization $authorization,
        ListFilesRequestDTO $requestDTO,
    ): ListFilesResponseDTO {
        $root = $this->getRoot($authorization);
        $response = new ListFilesResponseDTO();
        if ($requestDTO->parent_id === '' || $requestDTO->parent_id === '0') {
            $response->files = [MagicFSFileDTO::fromTaskFileEntity($root)];
            return $response;
        }
        $parent = $this->getDirectory($authorization, $root, $requestDTO->parent_id);
        $children = $this->magicFS->listFilesByParentId((string) $parent->getFileId(), $parent->getSpaceType());
        $response->files = array_values(array_map(
            static fn (TaskFileEntity $file): MagicFSFileDTO => MagicFSFileDTO::fromTaskFileEntity($file),
            array_filter($children, fn (TaskFileEntity $file): bool => $file->getParentId() === $parent->getFileId()
                && $this->ownership->belongsToCurrentUserSpace($file, $authorization)),
        ));
        return $response;
    }

    public function listProjectAttachments(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsRequestDTO $requestDTO,
    ): array {
        $root = $this->getRoot($authorization);
        $parentId = $requestDTO->getParentId();
        return $this->treeService->listProjectAttachments(
            $authorization,
            $requestDTO,
            $parentId === null || $parentId === '' ? $root : $this->getDirectory($authorization, $root, $parentId),
        );
    }

    public function listProjectAttachmentsV2(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsV2RequestDTO $requestDTO,
    ): array {
        $root = $this->getRoot($authorization);
        $queue = $requestDTO->getNextParentIds();
        if ($queue !== []) {
            $this->assertDirectories($authorization, $root, $this->treeService->getTraversalDirectories($queue));
        } elseif ($requestDTO->getParentId() !== null && $requestDTO->getParentId() !== '') {
            $root = $this->getDirectory($authorization, $root, $requestDTO->getParentId());
        }
        return $this->treeService->listProjectAttachmentsV2(
            $authorization,
            $requestDTO,
            $root,
            $this->treeService->formatAttachmentRowV2($root->toArray()),
        );
    }

    public function countProjectAttachments(MagicUserAuthorization $authorization): array
    {
        return ['total' => count($this->treeService->getTreeEntities($authorization, $this->getRoot($authorization)))];
    }

    public function getUploadToken(
        MagicUserAuthorization $authorization,
        ProjectUploadTokenRequestDTO $requestDTO,
    ): array {
        $this->getRoot($authorization);
        return $this->fileAppService->getStsTemporaryCredentialV2(
            $authorization->getOrganizationCode(),
            StorageBucketType::SandBox->value,
            WorkDirectoryUtil::getUserWorkDir($authorization->getId()),
            $requestDTO->getExpires(),
            false,
        );
    }

    private function getRoot(MagicUserAuthorization $authorization): TaskFileEntity
    {
        $rootId = $this->files->findOrCreateUserRootDirectory($authorization->getId(), $authorization->getOrganizationCode());
        $root = $this->files->getById($rootId);
        if ($root === null || ! $root->getIsDirectory() || $root->getParentId() !== null
            || $root->getFileName() !== '/' || ! $this->ownership->belongsToCurrentUserSpace($root, $authorization)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }
        return $root;
    }

    private function getDirectory(MagicUserAuthorization $authorization, TaskFileEntity $root, string $id): TaskFileEntity
    {
        $this->treeService->assertValidParentId($id);
        $directory = $this->files->getById((int) $id);
        if ($directory === null || ! $directory->getIsDirectory()) {
            ExceptionBuilder::throw(MagicFSErrorCode::PARENT_DIRECTORY_NOT_FOUND, 'magicfs.parent_directory_not_found');
        }
        $this->assertDirectories($authorization, $root, [$directory]);
        return $directory;
    }

    /** @param list<TaskFileEntity> $directories */
    private function assertDirectories(MagicUserAuthorization $authorization, TaskFileEntity $root, array $directories): void
    {
        // 根身份由真实根查询确定；其余节点复用引用解析的完整父链校验，不能仅凭 project_id=0 放行。
        $selectors = [];
        foreach ($directories as $directory) {
            if (! $directory->getIsDirectory() || ! $this->ownership->belongsToCurrentUserSpace($directory, $authorization)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
            if ($directory->getFileId() !== $root->getFileId()) {
                $selectors[] = FileReferenceSelectorDTO::fromInput(['file_id' => $directory->getFileId()]);
            }
        }
        foreach ($this->references->resolve($authorization, $selectors) as $result) {
            if ($result->status !== FileReferenceStatus::Resolved || $result->reference?->spaceType !== FileSpaceType::USER) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
        }
    }
}

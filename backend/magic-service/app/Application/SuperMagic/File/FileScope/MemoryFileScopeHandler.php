<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\FileScope;

use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\File\Service\FileMemoryAccessService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetProjectAttachmentsV2RequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\ListFilesRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\ListFilesResponseDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Response\MagicFSFileDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;

/**
 * 文件记忆作用域处理器。
 */
final class MemoryFileScopeHandler implements FileScopeHandlerInterface
{
    public const string SCOPE = 'memory';

    /**
     * 注入文件记忆访问、文件查询与树构建能力。
     */
    public function __construct(
        private readonly FileMemoryAccessService $fileMemoryAccessService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly FileScopeTreeService $treeService,
        private readonly FileAppService $fileAppService,
    ) {
    }

    /**
     * 列出当前用户的记忆目录入口或记忆目录中的直接子节点。
     */
    public function listFiles(
        MagicUserAuthorization $authorization,
        ListFilesRequestDTO $requestDTO,
    ): ListFilesResponseDTO {
        $responseDTO = new ListFilesResponseDTO();
        if ($requestDTO->parent_id === '' || $requestDTO->parent_id === '0') {
            $memoryRoot = $this->fileMemoryAccessService->getOrCreateMemoryRoot($authorization);
            $responseDTO->files = [MagicFSFileDTO::fromTaskFileEntity($memoryRoot)];
            return $responseDTO;
        }

        $this->treeService->assertValidParentId($requestDTO->parent_id);
        $parent = $this->fileMemoryAccessService->getAccessibleDirectory(
            $authorization,
            $requestDTO->parent_id,
        );

        $fileEntities = $this->magicFSFileDomainService->listFilesByParentId(
            (string) $parent->getFileId(),
            $parent->getSpaceType(),
        );
        $fileEntities = array_values(array_filter(
            $fileEntities,
            fn (TaskFileEntity $entity): bool => $entity->getParentId() === $parent->getFileId()
                && $this->fileMemoryAccessService->belongsToCurrentUserSpace($entity, $authorization),
        ));

        $responseDTO->files = array_map(
            static fn (TaskFileEntity $entity): MagicFSFileDTO => MagicFSFileDTO::fromTaskFileEntity($entity),
            $fileEntities,
        );

        return $responseDTO;
    }

    /**
     * 按项目附件 V1 协议返回记忆目录及完整子树。
     */
    public function listProjectAttachments(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsRequestDTO $requestDTO,
    ): array {
        return $this->treeService->listProjectAttachments(
            $authorization,
            $requestDTO,
            $this->resolveTraversalRoot($authorization, $requestDTO->getParentId()),
        );
    }

    /**
     * 按项目附件 V2 协议分页遍历记忆目录。
     */
    public function listProjectAttachmentsV2(
        MagicUserAuthorization $authorization,
        GetProjectAttachmentsV2RequestDTO $requestDTO,
    ): array {
        $queue = $requestDTO->getNextParentIds();
        if ($queue !== []) {
            $this->assertAccessibleTraversalQueue($authorization, $queue);
        }
        $root = $queue === []
            ? $this->resolveTraversalRoot($authorization, $requestDTO->getParentId())
            : $this->fileMemoryAccessService->getOrCreateMemoryRoot($authorization);

        return $this->treeService->listProjectAttachmentsV2(
            $authorization,
            $requestDTO,
            $root,
            $this->formatMemoryTraversalRootV2($root),
        );
    }

    /**
     * 统计当前用户记忆目录及其全部后代节点数量。
     */
    public function countProjectAttachments(MagicUserAuthorization $authorization): array
    {
        $root = $this->fileMemoryAccessService->getOrCreateMemoryRoot($authorization);

        return [
            'total' => count($this->treeService->getTreeEntities($authorization, $root)),
        ];
    }

    /**
     * 获取记忆空间上传凭证。
     */
    public function getUploadToken(
        MagicUserAuthorization $authorization,
        ProjectUploadTokenRequestDTO $requestDTO,
    ): array {
        $this->fileMemoryAccessService->getOrCreateMemoryRoot($authorization);

        return $this->fileAppService->getStsTemporaryCredentialV2(
            $authorization->getOrganizationCode(),
            StorageBucketType::SandBox->value,
            WorkDirectoryUtil::getUserWorkDir($authorization->getId()),
            $requestDTO->getExpires(),
            false,
        );
    }

    /**
     * 解析本次查询的记忆目录遍历根节点。
     */
    private function resolveTraversalRoot(
        MagicUserAuthorization $authorization,
        ?string $parentId,
    ): TaskFileEntity {
        if ($parentId === null || $parentId === '') {
            return $this->fileMemoryAccessService->getOrCreateMemoryRoot($authorization);
        }

        $this->treeService->assertValidParentId($parentId);
        return $this->fileMemoryAccessService->getAccessibleDirectory($authorization, $parentId);
    }

    /**
     * 批量校验 V2 游标中的目录均属于当前用户记忆子树。
     *
     * @param array<int, array{parent_id: string, after_sort: null|int, after_file_id: null|string}> $queue
     */
    private function assertAccessibleTraversalQueue(
        MagicUserAuthorization $authorization,
        array $queue,
    ): void {
        $this->fileMemoryAccessService->assertAccessibleNodes(
            $authorization,
            $this->treeService->getTraversalDirectories($queue),
        );
    }

    /**
     * 将记忆空间遍历根节点转换为 V2 响应格式。
     */
    private function formatMemoryTraversalRootV2(TaskFileEntity $root): array
    {
        $item = $this->treeService->formatAttachmentRowV2($root->toArray());

        if ($root->getFileName() === 'memory' && $root->getIsDirectory()) {
            // 前端特殊处理：scope=memory 时，业务上需要将 memory 目录实体作为根目录返回。
            // 根目录的 parent_id 应为 null，因此这里只重写响应字段，不修改实际文件父子关系。
            $item['parent_id'] = null;
        }

        return $item;
    }
}

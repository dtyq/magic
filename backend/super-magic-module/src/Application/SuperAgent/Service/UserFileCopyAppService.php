<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\FileBatchCopyPublisher;
use Dtyq\SuperMagic\Domain\MagicFS\Service\MagicFSFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileSpaceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchCopyEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\FileBatchOperationStatusManager;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileBatchOperationResponseDTO;
use Hyperf\Amqp\Producer;

/** 个人复制只适配权限与任务参数，目录合并和存储复制仍使用原批量消费者。 */
class UserFileCopyAppService extends AbstractAppService
{
    public function __construct(
        private readonly TaskFileDomainService $files,
        private readonly MagicFSFileDomainService $magicFS,
        private readonly FileBatchOperationStatusManager $status,
        private readonly Producer $producer,
    ) {
    }

    /** @param list<int> $fileIds
     * @param list<string> $keepBothFileIds
     * @return array<string, mixed>
     */
    public function copy(MagicUserAuthorization $authorization, array $fileIds, int $targetParentId, ?int $targetProjectId, array $keepBothFileIds): array
    {
        if ($targetProjectId !== null || $targetParentId <= 0 || $fileIds === []) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }
        $target = $this->assertOwner($this->files->getById($targetParentId), $authorization);
        if (! $target->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'file.target_parent_not_directory');
        }

        $sourceIds = array_fill_keys($fileIds, true);
        foreach ($this->files->getFilesWithParentsByIds([$targetParentId], 0) as $ancestor) {
            $this->assertOwner($ancestor, $authorization);
            if (isset($sourceIds[$ancestor->getFileId()])) {
                ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'file.operation_failed');
            }
        }

        $expanded = [];
        foreach (array_keys($sourceIds) as $fileId) {
            $source = $this->assertOwner($this->files->getById($fileId), $authorization);
            if ($source->getParentId() === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
            $expanded[$fileId] = $fileId;
            if (! $source->getIsDirectory()) {
                continue;
            }
            $tree = $this->magicFS->getFileTree((string) $fileId);
            foreach ($tree['children'] ?? [] as $child) {
                if (! $child instanceof TaskFileEntity) {
                    continue;
                }
                $this->assertOwner($child, $authorization);
                $expanded[$child->getFileId()] = $child->getFileId();
            }
        }

        $batchKey = $this->status->generateBatchKey(FileBatchOperationStatusManager::OPERATION_COPY, $authorization->getId(), (string) reset($fileIds));
        $this->status->initializeTask($batchKey, FileBatchOperationStatusManager::OPERATION_COPY, $authorization->getId(), count($expanded));
        $event = FileBatchCopyEvent::fromDTO($batchKey, $authorization->getId(), $authorization->getOrganizationCode(), array_values($expanded), 0, 0, null, $targetParentId, $keepBothFileIds, false, FileSpaceType::User);
        $this->producer->produce(new FileBatchCopyPublisher($event));
        return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
    }

    private function assertOwner(?TaskFileEntity $file, MagicUserAuthorization $authorization): TaskFileEntity
    {
        if ($file === null || $file->getSpaceType() !== FileSpaceType::User->value || $file->isProjectFile() || ! $this->hasTaskFileOwnerPermission($file, $authorization)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }
        return $file;
    }
}

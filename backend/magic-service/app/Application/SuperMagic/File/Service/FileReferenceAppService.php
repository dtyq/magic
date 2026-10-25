<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\FileReferenceSelectorDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceResultDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileReferenceStatus;

/**
 * 文件引用的只读投影；列表展示路径不能代替所属空间的完整父链路径。
 */
final class FileReferenceAppService extends AbstractAppService
{
    public function __construct(
        private readonly TaskFileDomainService $files,
        private readonly TaskFileRepositoryInterface $repository,
        private readonly TaskFileAuthorizationService $authorizationService,
    ) {
    }

    /**
     * @param list<FileReferenceSelectorDTO> $selectors
     * @return list<FileReferenceResultDTO>
     */
    public function resolve(MagicUserAuthorization $authorization, array $selectors): array
    {
        $userRoot = $this->repository->findUserSpaceRootDirectory(
            $authorization->getId(),
            $authorization->getOrganizationCode()
        );
        $ids = [];
        $selectedIds = [];
        $pathCache = [];
        foreach ($selectors as $selector) {
            if (! $selector->isValid() || array_key_exists($selector->key(), $selectedIds)) {
                continue;
            }
            $id = $selector->fileId;
            if ($id === null && $selector->userPath !== null && $userRoot !== null) {
                $id = $this->findUserPath($selector->userPath, $userRoot, $authorization, $pathCache)?->getFileId();
            }
            $selectedIds[$selector->key()] = $id;
            if ($id !== null) {
                $ids[$id] = $id;
            }
        }

        $entities = $this->files->getFilesByIds(array_values($ids));
        $groups = [];
        foreach ($entities as $entity) {
            $space = FileSpaceType::tryFrom($entity->getSpaceType());
            if ($space === FileSpaceType::USER && $this->isCurrentUserFile($entity, $authorization)) {
                $groups['user'][] = $entity->getFileId();
            } elseif ($space === FileSpaceType::PROJECT && $entity->getProjectId() > 0) {
                $groups['project:' . $entity->getProjectId()][] = $entity->getFileId();
            }
        }

        $allowed = [];
        foreach ($groups as $fileIds) {
            try {
                array_push($allowed, ...$this->authorizationService->authorizeFilesByIds($authorization, $fileIds));
            } catch (BusinessException $exception) {
                // 一项无权限不能丢弃其他空间的结果；数据库/服务故障仍应向上抛出。
                if (! in_array($exception->getCode(), [
                    SuperAgentErrorCode::FILE_NOT_FOUND->value,
                    SuperAgentErrorCode::FILE_PERMISSION_DENIED->value,
                    SuperAgentErrorCode::PROJECT_NOT_FOUND->value,
                    SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value,
                ], true)) {
                    throw $exception;
                }
            }
        }

        $parents = RelativeFilePathUtil::indexByFileId($this->files->getFilesWithParentsByIds(
            array_map(static fn (TaskFileEntity $file): int => $file->getFileId(), $allowed)
        ));
        $roots = ['user' => $userRoot];
        $resolved = [];
        foreach ($allowed as $file) {
            $space = FileSpaceType::from($file->getSpaceType());
            $rootKey = $space === FileSpaceType::USER ? 'user' : 'project:' . $file->getProjectId();
            if (! array_key_exists($rootKey, $roots)) {
                $roots[$rootKey] = $this->repository->findRootDirectoryByProjectId($file->getProjectId());
            }
            $root = $roots[$rootKey];
            if ($root === null || $file->getFileId() === $root->getFileId()
                || ! $this->hasCompleteChain($file, $root, $parents, $authorization)) {
                continue;
            }
            $resolved[$file->getFileId()] = new FileReferenceDTO(
                fileId: (string) $file->getFileId(),
                fileName: $file->getFileName(),
                isDirectory: $file->getIsDirectory(),
                fileExtension: $file->getFileExtension(),
                spaceType: $space,
                spaceRelativePath: ltrim(RelativeFilePathUtil::buildPathByParentChain($file, $parents), '/'),
                projectId: $space === FileSpaceType::PROJECT ? (string) $file->getProjectId() : null,
            );
        }

        return array_map(static function (FileReferenceSelectorDTO $selector) use ($selectedIds, $resolved): FileReferenceResultDTO {
            if (! $selector->isValid()) {
                return new FileReferenceResultDTO(FileReferenceStatus::Invalid);
            }
            $reference = $resolved[$selectedIds[$selector->key()] ?? 0] ?? null;
            return new FileReferenceResultDTO(
                $reference === null ? FileReferenceStatus::Unavailable : FileReferenceStatus::Resolved,
                $reference
            );
        }, $selectors);
    }

    /**
     * 只从当前用户根逐段查找，缓存公共前缀；不读取完整用户树，也不创建根目录。
     *
     * @param array<string, null|TaskFileEntity> $cache
     */
    private function findUserPath(
        string $path,
        TaskFileEntity $root,
        MagicUserAuthorization $authorization,
        array &$cache,
    ): ?TaskFileEntity {
        $current = $root;
        foreach (explode('/', $path) as $segment) {
            if (! $current->getIsDirectory() || ! $this->isCurrentUserFile($current, $authorization)) {
                return null;
            }
            $key = $current->getFileId() . '/' . $segment;
            if (! array_key_exists($key, $cache)) {
                $cache[$key] = $this->files->getByProjectParentAndName(0, $current->getFileId(), $segment);
            }
            $current = $cache[$key];
            if ($current === null || ! $this->isCurrentUserFile($current, $authorization)) {
                return null;
            }
        }
        return $current;
    }

    /** @param array<int, TaskFileEntity> $parents */
    private function hasCompleteChain(
        TaskFileEntity $file,
        TaskFileEntity $root,
        array $parents,
        MagicUserAuthorization $authorization,
    ): bool {
        $current = $file;
        $visited = [];
        while (true) {
            $id = $current->getFileId();
            if (isset($visited[$id])
                || $current->getSpaceType() !== $root->getSpaceType()
                || $current->getProjectId() !== $root->getProjectId()
                || $current->getOrganizationCode() !== $root->getOrganizationCode()
                || ($root->getSpaceType() === FileSpaceType::USER->value
                    && ! $this->isCurrentUserFile($current, $authorization))) {
                return false;
            }
            if ($id === $root->getFileId()) {
                return $root->getParentId() === null && $root->getIsDirectory() && $root->getFileName() === '/';
            }
            if (! FileReferenceSelectorDTO::isValidPath($current->getFileName())
                || str_contains($current->getFileName(), '/')) {
                return false;
            }
            $visited[$id] = true;
            $parent = $parents[$current->getParentId() ?? 0] ?? null;
            if ($parent === null || ! $parent->getIsDirectory()) {
                return false;
            }
            $current = $parent;
        }
    }

    private function isCurrentUserFile(TaskFileEntity $file, MagicUserAuthorization $authorization): bool
    {
        return $file->getSpaceType() === FileSpaceType::USER->value
            && $file->getProjectId() === 0
            && $this->hasTaskFileOwnerPermission($file, $authorization);
    }
}

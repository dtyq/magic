<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceVersionEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WorkspaceVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\WorkspaceVersionModel;

class WorkspaceVersionRepository implements WorkspaceVersionRepositoryInterface
{
    public function create(WorkspaceVersionEntity $entity): WorkspaceVersionEntity
    {
        $model = new WorkspaceVersionModel();
        $model->fill([
            'id' => $entity->getId(),
            'topic_id' => $entity->getTopicId(),
            'sandbox_id' => $entity->getSandboxId(),
            'commit_hash' => $entity->getCommitHash(),
            'dir' => $entity->getDir(),
            'folder' => $entity->getFolder(),
            'project_id' => $entity->getProjectId(),
            'tag' => $entity->getTag(),
            'created_at' => $entity->getCreatedAt(),
            'updated_at' => $entity->getUpdatedAt(),
            'deleted_at' => $entity->getDeletedAt(),
        ]);
        $model->save();
        $entity->setId($model->id);
        return $entity;
    }

    public function findById(int $id): ?WorkspaceVersionEntity
    {
        $model = WorkspaceVersionModel::query()->find($id);
        if (! $model) {
            return null;
        }
        return $this->toEntity($model);
    }

    public function findByTopicId(int $topicId): array
    {
        $models = WorkspaceVersionModel::query()->where('topic_id', $topicId)->get();
        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->toEntity($model);
        }
        return $entities;
    }

    public function findByCommitHashAndProjectId(string $commitHash, int $projectId, string $folder = ''): ?WorkspaceVersionEntity
    {
        $model = WorkspaceVersionModel::query()
            ->where('commit_hash', $commitHash)
            ->where('project_id', $projectId)
            ->where('folder', $folder)
            ->first();
        if (! $model) {
            return null;
        }
        return $this->toEntity($model);
    }

    public function findByProjectId(int $projectId, string $folder = ''): ?WorkspaceVersionEntity
    {
        $model = WorkspaceVersionModel::query()
            ->where('project_id', $projectId)
            ->where('folder', $folder)
            ->orderBy('id', 'desc')
            ->first();
        if (! $model) {
            return null;
        }
        return $this->toEntity($model);
    }

    public function getLatestVersionByProjectId(int $projectId): ?WorkspaceVersionEntity
    {
        $model = WorkspaceVersionModel::query()->where('project_id', $projectId)->orderBy('tag', 'desc')->first();
        if (! $model) {
            return null;
        }
        return $this->toEntity($model);
    }

    public function getLatestUpdateVersionProjectId(int $projectId): ?WorkspaceVersionEntity
    {
        $model = WorkspaceVersionModel::query()->where('project_id', $projectId)->orderBy('id', 'desc')->first();
        if (! $model) {
            return null;
        }
        return $this->toEntity($model);
    }

    public function getTagByCommitHashAndProjectId(string $commitHash, int $projectId): int
    {
        $model = WorkspaceVersionModel::query()->where('commit_hash', $commitHash)->where('project_id', $projectId)->orderBy('tag', 'desc')->first();
        if (! $model) {
            return 0;
        }
        $entity = $this->toEntity($model);
        return $entity->getTag();
    }

    private function toEntity($model): WorkspaceVersionEntity
    {
        $entity = new WorkspaceVersionEntity();
        $entity->setId((int) $model->id);
        $entity->setTopicId((int) $model->topic_id);
        $entity->setSandboxId((string) $model->sandbox_id);
        $entity->setCommitHash((string) $model->commit_hash);
        $entity->setDir((string) $model->dir);
        $entity->setFolder((string) $model->folder);
        $entity->setCreatedAt($model->created_at ? (string) $model->created_at : null);
        $entity->setUpdatedAt($model->updated_at ? (string) $model->updated_at : null);
        $entity->setDeletedAt($model->deleted_at ? (string) $model->deleted_at : null);
        $entity->setProjectId((int) $model->project_id);
        $entity->setTag((int) $model->tag);
        return $entity;
    }
}

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WarmPoolSandboxStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WarmPoolSandboxRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\WarmPoolSandboxModel;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;

class WarmPoolSandboxRepository implements WarmPoolSandboxRepositoryInterface
{
    /**
     * Logical environment tag. Every query is scoped to this value so two
     * deployments (e.g. pre + prod) can safely share the same physical
     * table without ripping out each other's warm-pool rows.
     */
    private readonly string $env;

    public function __construct(ConfigInterface $config)
    {
        $env = (string) $config->get('super-magic.warm_pool.env', 'default');
        $this->env = $env !== '' ? $env : 'default';
    }

    public function insert(WarmPoolSandboxEntity $entity): WarmPoolSandboxEntity
    {
        $now = date('Y-m-d H:i:s');
        if ($entity->getEnv() === '' || $entity->getEnv() === 'default') {
            // Default the row to this deployment's env unless the caller
            // explicitly overrode it. Keeps callers from having to know
            // about env scoping.
            $entity->setEnv($this->env);
        }
        if ($entity->getId() <= 0) {
            // Snowflake id assigned at the repository so callers don't have to
            // know about id generation, and so the column does not depend on
            // MySQL AUTO_INCREMENT (which conflicts with sharing a table
            // across deployments).
            $entity->setId((int) IdGenerator::getSnowId());
        }
        $model = new WarmPoolSandboxModel();
        $model->fill([
            'id' => $entity->getId(),
            'sandbox_id' => $entity->getSandboxId(),
            'sandbox_name' => $entity->getSandboxName(),
            'agent_image' => $entity->getAgentImage(),
            'env' => $entity->getEnv(),
            'status' => $entity->getStatus(),
            'bound_user_id' => $entity->getBoundUserId(),
            'bound_project_id' => $entity->getBoundProjectId(),
            'bound_topic_id' => $entity->getBoundTopicId(),
            'bound_at' => $entity->getBoundAt(),
            'expires_at' => $entity->getExpiresAt(),
            'dead_reason' => $entity->getDeadReason(),
            'created_at' => $entity->getCreatedAt() ?? $now,
            'updated_at' => $entity->getUpdatedAt() ?? $now,
        ]);
        $model->save();
        $entity->setId((int) $model->id);
        $entity->setCreatedAt((string) $model->created_at);
        $entity->setUpdatedAt((string) $model->updated_at);
        return $entity;
    }

    public function findById(int $id): ?WarmPoolSandboxEntity
    {
        $model = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('id', $id)
            ->first();
        return $model ? $this->toEntity($model) : null;
    }

    public function findBySandboxId(string $sandboxId): ?WarmPoolSandboxEntity
    {
        $model = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('sandbox_id', $sandboxId)
            ->first();
        return $model ? $this->toEntity($model) : null;
    }

    public function findExpired(string $now, int $limit = 100): array
    {
        // Treat everything still creating/ready past expires_at as evictable.
        // `claimed` rows are owned by user requests now and should not be
        // ripped out of the table just because they happen to be old.
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->whereIn('status', [WarmPoolSandboxStatus::Creating->value, WarmPoolSandboxStatus::Ready->value, WarmPoolSandboxStatus::Dead->value])
            ->where('expires_at', '<=', $now)
            ->orderBy('expires_at', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function findByImageAndStatuses(string $agentImage, array $statuses, int $limit = 100): array
    {
        if (empty($statuses)) {
            return [];
        }
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('agent_image', $agentImage)
            ->whereIn('status', $statuses)
            ->orderBy('id', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function findReadyExcludingImage(string $currentAgentImage, int $limit = 100): array
    {
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->whereIn('status', [WarmPoolSandboxStatus::Creating->value, WarmPoolSandboxStatus::Ready->value])
            ->where('agent_image', '!=', $currentAgentImage)
            ->orderBy('id', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function countByImageAndStatuses(string $agentImage, array $statuses): int
    {
        if (empty($statuses)) {
            return 0;
        }
        return WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('agent_image', $agentImage)
            ->whereIn('status', $statuses)
            ->count();
    }

    public function claimOneReady(
        string $agentImage,
        string $userId,
        string $projectId,
        string $now,
        ?string $topicId = null
    ): ?WarmPoolSandboxEntity {
        return Db::transaction(function () use ($agentImage, $userId, $projectId, $now, $topicId) {
            // SKIP LOCKED is the whole point: other workers should not block
            // on a row we're already taking, they should fall to the next.
            $model = WarmPoolSandboxModel::query()
                ->where('env', $this->env)
                ->where('agent_image', $agentImage)
                ->where('status', WarmPoolSandboxStatus::Ready->value)
                ->orderBy('id', 'ASC')
                ->lock('FOR UPDATE SKIP LOCKED')
                ->first();
            if (! $model) {
                return null;
            }
            $model->status = WarmPoolSandboxStatus::Claimed->value;
            $model->bound_user_id = $userId;
            $model->bound_project_id = $projectId;
            $model->bound_topic_id = $topicId;
            $model->bound_at = $now;
            $model->updated_at = $now;
            $model->save();
            return $this->toEntity($model);
        });
    }

    public function updateStatus(int $id, string $status, ?string $deadReason = null): bool
    {
        $attrs = [
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if ($deadReason !== null) {
            $attrs['dead_reason'] = $deadReason;
        }
        return WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('id', $id)
            ->update($attrs) > 0;
    }

    public function markForEviction(int $id, string $reason): bool
    {
        // Conditional transition: only pooled states (creating / ready / dead)
        // may be flipped to `dead`. A row that a concurrent user request has
        // already claimed is intentionally excluded, so the eviction loser
        // gets 0 affected rows and must leave that pod alone.
        return WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('id', $id)
            ->whereIn('status', [
                WarmPoolSandboxStatus::Creating->value,
                WarmPoolSandboxStatus::Ready->value,
                WarmPoolSandboxStatus::Dead->value,
            ])
            ->update([
                'status' => WarmPoolSandboxStatus::Dead->value,
                'dead_reason' => mb_substr($reason, 0, 250),
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function markReady(int $id, ?int $provisionDurationMs = null): bool
    {
        $attrs = [
            'status' => WarmPoolSandboxStatus::Ready->value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if ($provisionDurationMs !== null) {
            $attrs['provision_duration_ms'] = $provisionDurationMs;
        }
        return WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('id', $id)
            ->where('status', WarmPoolSandboxStatus::Creating->value)
            ->update($attrs) > 0;
    }

    public function deleteById(int $id): bool
    {
        return WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('id', $id)
            ->delete() > 0;
    }

    public function findAllPooled(int $limit = 500): array
    {
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->whereIn('status', [
                WarmPoolSandboxStatus::Creating->value,
                WarmPoolSandboxStatus::Ready->value,
                WarmPoolSandboxStatus::Dead->value,
            ])
            ->orderBy('id', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function findReadyForReconcile(int $limit = 100): array
    {
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('status', WarmPoolSandboxStatus::Ready->value)
            ->orderBy('id', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function findClaimedBefore(string $boundBefore, int $limit = 100): array
    {
        $models = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->where('status', WarmPoolSandboxStatus::Claimed->value)
            ->where('bound_at', '<=', $boundBefore)
            ->orderBy('bound_at', 'ASC')
            ->limit($limit)
            ->get();
        return array_map(fn ($m) => $this->toEntity($m), $models->all());
    }

    public function findLatestAgentImage(): ?string
    {
        $model = WarmPoolSandboxModel::query()
            ->where('env', $this->env)
            ->orderBy('id', 'DESC')
            ->first(['agent_image']);
        return $model ? (string) $model->agent_image : null;
    }

    private function toEntity(WarmPoolSandboxModel $model): WarmPoolSandboxEntity
    {
        $e = new WarmPoolSandboxEntity();
        $e->setId((int) $model->id);
        $e->setSandboxId((string) $model->sandbox_id);
        $e->setSandboxName((string) $model->sandbox_name);
        $e->setAgentImage((string) $model->agent_image);
        $e->setEnv((string) ($model->env ?? 'default'));
        $e->setStatus((string) $model->status);
        $e->setProvisionDurationMs($model->provision_duration_ms !== null ? (int) $model->provision_duration_ms : null);
        $e->setBoundUserId($model->bound_user_id !== null ? (string) $model->bound_user_id : null);
        $e->setBoundProjectId($model->bound_project_id !== null ? (string) $model->bound_project_id : null);
        $e->setBoundTopicId($model->bound_topic_id !== null ? (string) $model->bound_topic_id : null);
        $e->setBoundAt($model->bound_at !== null ? (string) $model->bound_at : null);
        $e->setExpiresAt($model->expires_at !== null ? (string) $model->expires_at : null);
        $e->setDeadReason($model->dead_reason !== null ? (string) $model->dead_reason : null);
        $e->setCreatedAt($model->created_at !== null ? (string) $model->created_at : null);
        $e->setUpdatedAt($model->updated_at !== null ? (string) $model->updated_at : null);
        return $e;
    }
}

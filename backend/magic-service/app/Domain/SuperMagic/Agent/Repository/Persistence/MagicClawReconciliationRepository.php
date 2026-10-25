<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Repository\Persistence;

use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\MagicClawModel;
use App\Domain\SuperMagic\Message\Repository\Model\MessageQueueModel;
use App\Domain\SuperMagic\Topic\Repository\Model\TopicModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;

class MagicClawReconciliationRepository
{
    private const OPERATIONS = 'magic_claw_permission_reconciliations';

    private const ITEMS = 'magic_claw_permission_reconciliation_items';

    /**
     * Operation zero is a resource binding, not a stop request. Keeping this
     * unique row outside real operations excludes it from progress and retries.
     */
    public function bindConverter(int $clawId, string $sandboxId): void
    {
        $now = date('Y-m-d H:i:s');
        Db::table(self::ITEMS)->insertOrIgnore([
            'operation_id' => 0, 'claw_id' => $clawId, 'topic_id' => 0,
            'sandbox_id' => $sandboxId, 'status' => 'bound', 'created_at' => $now, 'updated_at' => $now,
        ]);
        Db::table(self::ITEMS)->where('operation_id', 0)->where('claw_id', $clawId)->where('topic_id', 0)
            ->update(['sandbox_id' => $sandboxId, 'updated_at' => $now]);
    }

    public function converterSandbox(int $clawId): string
    {
        return (string) (Db::table(self::ITEMS)->where('operation_id', 0)->where('claw_id', $clawId)
            ->where('topic_id', 0)->value('sandbox_id') ?? '');
    }

    public function clearConverter(int $clawId, string $sandboxId): void
    {
        Db::table(self::ITEMS)->where('operation_id', 0)->where('claw_id', $clawId)->where('topic_id', 0)
            ->where('sandbox_id', $sandboxId)->delete();
    }

    public function requireManualStart(array $item): void
    {
        $this->updateItem($item, ['requires_manual_start' => true]);
    }

    /** Operation IDs already order revocations; no second revision is stored on the claw. */
    public function pauseRevision(int $clawId): string
    {
        return (string) (Db::table(self::ITEMS)->where('claw_id', $clawId)
            ->where('requires_manual_start', true)->max('operation_id') ?? '0');
    }

    public function resumeAfterStart(int $clawId, string $observedOperation): bool
    {
        // A start may acknowledge older pauses, but must never erase a newer stop.
        Db::table(self::ITEMS)->where('claw_id', $clawId)->where('requires_manual_start', true)
            ->where('operation_id', '<=', $observedOperation)
            ->update(['requires_manual_start' => false, 'updated_at' => date('Y-m-d H:i:s')]);
        return $this->pauseRevision($clawId) === '0';
    }

    /** Persist a late revocation before attempting cleanup, including failed cleanup. */
    public function recordRuntimeDenial(MagicClawEntity $claw, int $topicId, string $sandboxId): void
    {
        Db::transaction(function () use ($claw, $topicId, $sandboxId): void {
            if ($topicId === 0) {
                $this->bindConverter((int) $claw->getId(), $sandboxId);
            }
            $operation = $this->latest($claw->getOrganizationCode())
                ?? $this->create($claw->getOrganizationCode(), $claw->getUserId(), 'runtime_denied');
            $this->enqueue($operation, ['id' => $claw->getId()], ['id' => $topicId, 'sandbox_id' => $sandboxId]);
            Db::table(self::ITEMS)->where('operation_id', $operation['id'])->where('claw_id', $claw->getId())
                ->where('topic_id', $topicId)->update([
                    'sandbox_id' => $sandboxId, 'status' => 'pending', 'requires_manual_start' => true,
                    'next_retry_at' => 0, 'updated_at' => date('Y-m-d H:i:s'),
                ]);
            // A scan may have completed while this resource was being initialized.
            $this->updateOperation($operation, ['status' => 'running']);
        });
    }

    public function create(string $organization, string $actor, string $reason): array
    {
        $id = (string) IdGenerator::getSnowId();
        $now = date('Y-m-d H:i:s');
        Db::table(self::OPERATIONS)->where('organization_code', $organization)
            ->where('status', '!=', 'superseded')->update(['status' => 'superseded', 'updated_at' => $now]);
        Db::table(self::OPERATIONS)->insert([
            'id' => $id, 'organization_code' => $organization, 'actor' => $actor,
            'reason' => $reason, 'status' => 'pending', 'created_at' => $now, 'updated_at' => $now,
        ]);
        return $this->latest($organization) ?? [];
    }

    public function latest(string $organization): ?array
    {
        $row = Db::table(self::OPERATIONS)->where('organization_code', $organization)->orderByDesc('id')->first();
        return $row === null ? null : (array) $row;
    }

    public function isCurrent(array $operation): bool
    {
        return (string) ($this->latest($operation['organization_code'])['id'] ?? '') === (string) $operation['id'];
    }

    public function activeOperations(int $limit): array
    {
        return Db::table(self::OPERATIONS)->whereIn('status', ['pending', 'running', 'partial_failed'])
            ->where('lease_until', '<', time())
            ->where(function ($query): void {
                $query->where('scan_completed', false)->orWhereExists(function ($items): void {
                    $items->selectRaw('1')->from(self::ITEMS)
                        ->whereColumn('operation_id', self::OPERATIONS . '.id')
                        ->whereIn('status', ['pending', 'failed'])->where('next_retry_at', '<=', time());
                });
            })->orderBy('updated_at')->limit($limit)->get()->map(fn ($row) => (array) $row)->all();
    }

    public function claim(array $operation, string $leaseOwner): bool
    {
        return Db::table(self::OPERATIONS)->where('id', $operation['id'])
            ->whereIn('status', ['pending', 'running', 'partial_failed'])->where('lease_until', '<', time())
            ->update(['lease_until' => time() + 300, 'lease_owner' => $leaseOwner]) > 0;
    }

    public function hasDueWork(array $operation): bool
    {
        return ! $operation['scan_completed'] || Db::table(self::ITEMS)->where('operation_id', $operation['id'])
            ->whereIn('status', ['pending', 'failed'])->where('next_retry_at', '<=', time())->exists();
    }

    public function renew(array $operation, string $owner): bool
    {
        $query = Db::table(self::OPERATIONS)->where('id', $operation['id'])->where('lease_owner', $owner)
            ->where('lease_until', '>=', time())->where('status', '!=', 'superseded');
        // MySQL may report zero changed rows when renewed twice in the same second.
        return (clone $query)->update(['lease_until' => time() + 300]) > 0 || $query->exists();
    }

    public function release(array $operation, string $leaseOwner): void
    {
        Db::table(self::OPERATIONS)->where('id', $operation['id'])->where('lease_owner', $leaseOwner)
            ->update(['lease_until' => 0, 'lease_owner' => '', 'updated_at' => date('Y-m-d H:i:s')]);
    }

    /** Stable cursors include soft-deleted owners/topics, whose pods may still exist. */
    public function claws(string $organization, int $after, int $limit = 100): array
    {
        return MagicClawModel::withTrashed()->where('organization_code', $organization)
            ->where(function ($query): void {
                $query->whereNull('deleted_at')->orWhere(function ($bindings): void {
                    $this->withRuntimeBindings($bindings);
                });
            })->where('id', '>', $after)->orderBy('id')->limit($limit)->get()->toArray();
    }

    /** @return iterable<array> */
    public function topics(array $claw): iterable
    {
        $cursor = 0;
        do {
            $rows = $this->topicPage($claw, $cursor, 100);
            foreach ($rows as $row) {
                $cursor = (int) $row['id'];
                yield $row;
            }
        } while (count($rows) === 100);
    }

    public function topicPage(array $claw, int $after, int $limit = 25): array
    {
        return TopicModel::withTrashed()->where('project_id', $claw['project_id'])
            ->where('user_organization_code', $claw['organization_code'])->where('user_id', $claw['user_id'])
            ->where('id', '>', $after)->orderBy('id')->limit($limit)->get()->toArray();
    }

    public function scannedTopicCursor(array $operation, array $claw): int
    {
        return (int) Db::table(self::ITEMS)->where('operation_id', $operation['id'])
            ->where('claw_id', $claw['id'])->max('topic_id');
    }

    public function topic(int $topicId): ?array
    {
        $topic = TopicModel::withTrashed()->where('id', $topicId)->first();
        return $topic?->toArray();
    }

    public function claw(int $clawId): ?array
    {
        return MagicClawModel::withTrashed()->where('id', $clawId)->first()?->toArray();
    }

    public function enqueue(array $operation, array $claw, array $topic): void
    {
        $now = date('Y-m-d H:i:s');
        Db::table(self::ITEMS)->insertOrIgnore([
            'operation_id' => $operation['id'], 'claw_id' => $claw['id'], 'topic_id' => $topic['id'],
            'sandbox_id' => (string) ($topic['sandbox_id'] ?? ''), 'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    public function updateOperation(array $operation, array $values): void
    {
        Db::table(self::OPERATIONS)->where('id', $operation['id'])->where('status', '!=', 'superseded')
            ->update($values + ['updated_at' => date('Y-m-d H:i:s')]);
    }

    public function dueItem(array $operation): ?array
    {
        $row = Db::table(self::ITEMS)->where('operation_id', $operation['id'])->whereIn('status', ['pending', 'failed'])
            ->where('next_retry_at', '<=', time())->orderBy('next_retry_at')->orderBy('id')->first();
        return $row === null ? null : (array) $row;
    }

    public function updateItem(array $item, array $values): void
    {
        Db::table(self::ITEMS)->where('id', $item['id'])->update($values + ['updated_at' => date('Y-m-d H:i:s')]);
    }

    public function cancelQueuedMessages(array $topic, string $reason = 'Magic Claw access revoked'): void
    {
        MessageQueueModel::query()
            ->where('topic_id', $topic['id'])->where('organization_code', $topic['user_organization_code'])
            ->whereIn('status', [0, 3])->update(['status' => 2, 'err_message' => $reason]);
    }

    public function clearBinding(int $topicId, string $sandboxId): void
    {
        TopicModel::withTrashed()->where('id', $topicId)->where('sandbox_id', $sandboxId)
            ->update(['sandbox_id' => '', 'current_task_status' => 'stopped']);
    }

    public function retry(array $operation): void
    {
        Db::table(self::ITEMS)->where('operation_id', $operation['id'])->where('status', 'failed')
            ->update(['next_retry_at' => 0]);
        $this->updateOperation($operation, ['status' => 'running']);
    }

    public function summarize(array $operation): array
    {
        $counts = Db::table(self::ITEMS)->where('operation_id', $operation['id'])
            ->selectRaw('claw_id, status, COUNT(*) AS total')->groupBy('claw_id', 'status')->get();
        $claws = [];
        $pending = 0;
        $failed = 0;
        foreach ($counts as $row) {
            // FetchModeListener returns arrays; also support the default object fetch mode.
            $row = (array) $row;
            $claws[(string) $row['claw_id']][(string) $row['status']] = (int) $row['total'];
            $pending += $row['status'] === 'pending' ? (int) $row['total'] : 0;
            $failed += $row['status'] === 'failed' ? (int) $row['total'] : 0;
        }
        $status = $operation['status'];
        if ($status !== 'superseded') {
            $status = ! $operation['scan_completed'] || $pending > 0 ? 'running' : ($failed > 0 ? 'partial_failed' : 'completed');
        }
        return [
            // Snowflake identifiers are strings to avoid JavaScript precision loss.
            'operation_id' => (string) $operation['id'], 'policy_revision' => (string) $operation['id'],
            'status' => $status,
            'affected_count' => $operation['scan_completed'] ? count($claws) : null,
            'stopped_count' => count(array_filter($claws, fn (array $states) => isset($states['stopped']) && ! isset($states['pending']) && ! isset($states['failed']))),
            'failed_count' => count(array_filter($claws, fn (array $states) => isset($states['failed']))),
            'skipped_count' => count(array_filter($claws, fn (array $states) => count($states) === 1 && isset($states['skipped']))),
        ];
    }

    private function withRuntimeBindings($query): void
    {
        $query->whereExists(function ($bindings): void {
            $bindings->selectRaw('1')->from(self::ITEMS)->where('operation_id', 0)->where('topic_id', 0)
                ->whereColumn('claw_id', 'magic_super_magic_claw.id')->where('sandbox_id', '!=', '');
        })->orWhereExists(function ($topics): void {
            $topics->selectRaw('1')->from('magic_super_agent_topics')
                ->whereColumn('project_id', 'magic_super_magic_claw.project_id')
                ->whereColumn('user_organization_code', 'magic_super_magic_claw.organization_code')
                ->whereColumn('user_id', 'magic_super_magic_claw.user_id')->where('sandbox_id', '!=', '');
        });
    }
}

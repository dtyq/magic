<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private const CHUNK_SIZE = 200;

    public function up(): void
    {
        if (! $this->requiredTablesExist()) {
            return;
        }

        Db::table('magic_super_magic_agents')
            ->select([
                'id',
                'organization_code',
                'code',
                'creator',
                'source_type',
                'source_id',
                'version_id',
                'created_at',
                'updated_at',
            ])
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($agents): void {
                foreach ($agents as $agent) {
                    $this->backfillUserAgentOwnership($this->normalizeAgentRow($agent));
                }
            }, 'id');
    }

    public function down(): void
    {
    }

    private function requiredTablesExist(): bool
    {
        return Db::getSchemaBuilder()->hasTable('magic_super_magic_agents')
            && Db::getSchemaBuilder()->hasTable('magic_super_magic_user_agents');
    }

    private function backfillUserAgentOwnership(array $agent): void
    {
        if (
            empty($agent['organization_code'])
            || empty($agent['code'])
            || empty($agent['creator'])
        ) {
            return;
        }

        $createdAt = $this->normalizeTimestamp($agent['created_at'] ?? null);
        $updatedAt = $this->normalizeTimestamp($agent['updated_at'] ?? null);

        $attributes = [
            'organization_code' => $agent['organization_code'],
            'user_id' => $agent['creator'],
            'agent_code' => $agent['code'],
            'agent_version_id' => $agent['version_id'] ?? null,
            'source_type' => (string) ($agent['source_type'] ?? 'LOCAL_CREATE'),
            'source_id' => $agent['source_id'] ?? null,
            'updated_at' => $updatedAt,
            'deleted_at' => null,
        ];

        $existing = Db::table('magic_super_magic_user_agents')
            ->where('organization_code', $agent['organization_code'])
            ->where('user_id', $agent['creator'])
            ->where('agent_code', $agent['code'])
            ->first();

        if ($existing === null) {
            Db::table('magic_super_magic_user_agents')->insert(array_merge($attributes, [
                'id' => IdGenerator::getSnowId(),
                'created_at' => $createdAt,
            ]));
            return;
        }

        Db::table('magic_super_magic_user_agents')
            ->where('id', $existing['id'])
            ->update($attributes);
    }

    private function normalizeAgentRow(mixed $agent): array
    {
        if (is_array($agent)) {
            return $agent;
        }

        return (array) $agent;
    }

    private function normalizeTimestamp(mixed $timestamp): string
    {
        if (is_string($timestamp) && $timestamp !== '') {
            return $timestamp;
        }

        if ($timestamp instanceof DateTimeInterface) {
            return $timestamp->format('Y-m-d H:i:s');
        }

        return date('Y-m-d H:i:s');
    }
};

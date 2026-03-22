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

    private const RESOURCE_VISIBILITY_PRINCIPAL_TYPE_USER = 1;

    private const RESOURCE_VISIBILITY_RESOURCE_TYPE_SUPER_MAGIC_AGENT = 1;

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
                'created_at',
                'updated_at',
            ])
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($agents): void {
                foreach ($agents as $agent) {
                    $this->backfillAgentResourceVisibility($this->normalizeRow($agent));
                }
            }, 'id');
    }

    public function down(): void
    {
    }

    private function requiredTablesExist(): bool
    {
        return Db::getSchemaBuilder()->hasTable('magic_super_magic_agents')
            && Db::getSchemaBuilder()->hasTable('magic_resource_visibility');
    }

    private function backfillAgentResourceVisibility(array $agent): void
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

        $exists = Db::table('magic_resource_visibility')
            ->where('organization_code', $agent['organization_code'])
            ->where('principal_type', self::RESOURCE_VISIBILITY_PRINCIPAL_TYPE_USER)
            ->where('principal_id', $agent['creator'])
            ->where('resource_type', self::RESOURCE_VISIBILITY_RESOURCE_TYPE_SUPER_MAGIC_AGENT)
            ->where('resource_code', $agent['code'])
            ->exists();

        if ($exists) {
            return;
        }

        Db::table('magic_resource_visibility')->insert([
            'id' => IdGenerator::getSnowId(),
            'organization_code' => $agent['organization_code'],
            'principal_type' => self::RESOURCE_VISIBILITY_PRINCIPAL_TYPE_USER,
            'principal_id' => $agent['creator'],
            'resource_type' => self::RESOURCE_VISIBILITY_RESOURCE_TYPE_SUPER_MAGIC_AGENT,
            'resource_code' => $agent['code'],
            'creator' => $agent['creator'],
            'modifier' => $agent['creator'],
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ]);
    }

    private function normalizeRow(mixed $row): array
    {
        if (is_array($row)) {
            return $row;
        }

        return (array) $row;
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

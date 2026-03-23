<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private const CHUNK_SIZE = 200;

    private const OPERATION_PERMISSION_RESOURCE_TYPE_SKILL = 7;

    private const OPERATION_PERMISSION_TARGET_TYPE_USER = 1;

    private const OPERATION_PERMISSION_OWNER = 1;

    private const RESOURCE_VISIBILITY_PRINCIPAL_TYPE_USER = 1;

    private const RESOURCE_VISIBILITY_RESOURCE_TYPE_SKILL = 2;

    public function up(): void
    {
        if (! $this->requiredTablesExist()) {
            return;
        }

        Db::table('magic_skills')
            ->select([
                'id',
                'organization_code',
                'code',
                'creator_id',
                'source_type',
                'source_id',
                'version_id',
                'created_at',
                'updated_at',
            ])
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($skills): void {
                foreach ($skills as $skill) {
                    $this->backfillSkill($this->normalizeSkillRow($skill));
                }
            }, 'id');
    }

    public function down(): void
    {
    }

    private function requiredTablesExist(): bool
    {
        return Db::getSchemaBuilder()->hasTable('magic_skills')
            && Db::getSchemaBuilder()->hasTable('magic_user_skills')
            && Db::getSchemaBuilder()->hasTable('magic_resource_visibility')
            && Db::getSchemaBuilder()->hasTable('magic_operation_permissions');
    }

    private function backfillSkill(array $skill): void
    {
        if (
            empty($skill['organization_code'])
            || empty($skill['code'])
            || empty($skill['creator_id'])
        ) {
            return;
        }

        $this->upsertUserSkill($skill);
        $this->upsertResourceVisibility($skill);

        if (($skill['source_type'] ?? null) === SkillSourceType::MARKET->value) {
            $this->softDeleteMarketSkill($skill);
            return;
        }

        $this->upsertOwnerOperationPermission($skill);
    }

    private function upsertUserSkill(array $skill): void
    {
        $now = $this->normalizeTimestamp($skill['updated_at'] ?? null);
        $createdAt = $this->normalizeTimestamp($skill['created_at'] ?? null);
        $isMarketSkill = ($skill['source_type'] ?? null) === SkillSourceType::MARKET->value;

        $attributes = [
            'organization_code' => $skill['organization_code'],
            'user_id' => $skill['creator_id'],
            'skill_code' => $skill['code'],
            'skill_version_id' => $isMarketSkill ? ($skill['version_id'] ?? null) : null,
            'source_type' => (string) $skill['source_type'],
            'source_id' => $isMarketSkill ? ($skill['source_id'] ?? null) : null,
            'updated_at' => $now,
            'deleted_at' => null,
        ];

        $existing = Db::table('magic_user_skills')
            ->where('organization_code', $skill['organization_code'])
            ->where('user_id', $skill['creator_id'])
            ->where('skill_code', $skill['code'])
            ->first();

        if ($existing === null) {
            Db::table('magic_user_skills')->insert(array_merge($attributes, [
                'id' => IdGenerator::getSnowId(),
                'created_at' => $createdAt,
            ]));
            return;
        }

        Db::table('magic_user_skills')
            ->where('id', $existing['id'])
            ->update($attributes);
    }

    private function upsertResourceVisibility(array $skill): void
    {
        $createdAt = $this->normalizeTimestamp($skill['created_at'] ?? null);
        $updatedAt = $this->normalizeTimestamp($skill['updated_at'] ?? null);

        Db::table('magic_resource_visibility')->updateOrInsert(
            [
                'organization_code' => $skill['organization_code'],
                'principal_type' => self::RESOURCE_VISIBILITY_PRINCIPAL_TYPE_USER,
                'principal_id' => $skill['creator_id'],
                'resource_type' => self::RESOURCE_VISIBILITY_RESOURCE_TYPE_SKILL,
                'resource_code' => $skill['code'],
            ],
            [
                'creator' => $skill['creator_id'],
                'modifier' => $skill['creator_id'],
                'created_at' => $createdAt,
                'updated_at' => $updatedAt,
            ]
        );
    }

    private function upsertOwnerOperationPermission(array $skill): void
    {
        $createdAt = $this->normalizeTimestamp($skill['created_at'] ?? null);
        $updatedAt = $this->normalizeTimestamp($skill['updated_at'] ?? null);

        $existing = Db::table('magic_operation_permissions')
            ->where('organization_code', $skill['organization_code'])
            ->where('resource_type', self::OPERATION_PERMISSION_RESOURCE_TYPE_SKILL)
            ->where('resource_id', $skill['code'])
            ->where('target_type', self::OPERATION_PERMISSION_TARGET_TYPE_USER)
            ->where('target_id', $skill['creator_id'])
            ->where('operation', self::OPERATION_PERMISSION_OWNER)
            ->first();

        $attributes = [
            'organization_code' => $skill['organization_code'],
            'resource_type' => self::OPERATION_PERMISSION_RESOURCE_TYPE_SKILL,
            'resource_id' => $skill['code'],
            'target_type' => self::OPERATION_PERMISSION_TARGET_TYPE_USER,
            'target_id' => $skill['creator_id'],
            'operation' => self::OPERATION_PERMISSION_OWNER,
            'created_uid' => $skill['creator_id'],
            'updated_uid' => $skill['creator_id'],
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
            'deleted_at' => null,
        ];

        if ($existing === null) {
            Db::table('magic_operation_permissions')->insert(array_merge($attributes, [
                'id' => IdGenerator::getSnowId(),
            ]));
            return;
        }

        Db::table('magic_operation_permissions')
            ->where('id', $existing['id'])
            ->update($attributes);
    }

    private function softDeleteMarketSkill(array $skill): void
    {
        $deletedAt = $this->normalizeTimestamp($skill['updated_at'] ?? null);

        Db::table('magic_skills')
            ->where('id', $skill['id'])
            ->where('source_type', SkillSourceType::MARKET->value)
            ->whereNull('deleted_at')
            ->update([
                'updated_at' => $deletedAt,
                'deleted_at' => $deletedAt,
            ]);
    }

    private function normalizeSkillRow(mixed $skill): array
    {
        if (is_array($skill)) {
            return $skill;
        }

        return (array) $skill;
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

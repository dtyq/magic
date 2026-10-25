<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    private const TABLE = 'magic_super_agent_project_member_settings';

    private const UNIQUE_INDEX = 'uk_user_project';

    public function up(): void
    {
        // This table has no deleted_at column, so duplicate rows are physical
        // rows and must be consolidated before adding the unique key.
        // Keep one row for each user/project pair. Prefer a workspace binding,
        // then the newest update/activity, and finally the largest snowflake ID.
        // This deliberately uses only the existing table; no temporary-table
        // privilege is required.
        Db::transaction(function (): void {
            $duplicateGroups = Db::table(self::TABLE)
                ->select(['user_id', 'project_id'])
                ->groupBy(['user_id', 'project_id'])
                ->havingRaw('COUNT(*) > 1')
                ->get();

            foreach ($duplicateGroups as $group) {
                $userId = is_array($group) ? $group['user_id'] : $group->user_id;
                $projectId = is_array($group) ? $group['project_id'] : $group->project_id;

                $rows = Db::table(self::TABLE)
                    ->where('user_id', $userId)
                    ->where('project_id', $projectId)
                    ->orderByDesc('is_bind_workspace')
                    ->orderByDesc('updated_at')
                    ->orderByDesc('last_active_at')
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->get();

                $deleteIds = [];
                $keepFirst = true;
                foreach ($rows as $row) {
                    if ($keepFirst) {
                        $keepFirst = false;
                        continue;
                    }

                    $deleteIds[] = is_array($row) ? $row['id'] : $row->id;
                }

                if ($deleteIds !== []) {
                    Db::table(self::TABLE)
                        ->whereIn('id', $deleteIds)
                        ->delete();
                }
            }
        });

        $remainingDuplicates = Db::table(self::TABLE)
            ->select(['user_id', 'project_id'])
            ->groupBy(['user_id', 'project_id'])
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($remainingDuplicates) {
            throw new RuntimeException('Duplicate project member settings remain; unique index was not added.');
        }

        if (! Schema::hasIndex(self::TABLE, self::UNIQUE_INDEX)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->unique(['user_id', 'project_id'], self::UNIQUE_INDEX);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasIndex(self::TABLE, self::UNIQUE_INDEX)) {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->dropUnique(self::UNIQUE_INDEX);
            });
        }
    }
};

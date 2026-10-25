<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_agent_project')
            || ! Schema::hasTable('magic_super_agent_micro_apps')) {
            return;
        }

        Db::table('magic_super_agent_project as p')
            ->whereNull('p.deleted_at')
            ->whereExists(function ($query): void {
                $query->select(Db::raw('1'))
                    ->from('magic_super_agent_micro_apps as ma')
                    ->whereColumn('ma.project_id', 'p.id')
                    ->whereNull('ma.deleted_at');
            })
            ->update(['project_mode' => 'micro-app']);
    }

    public function down(): void
    {
        // This historical backfill is intentionally irreversible. Reverting by
        // project mode would also mutate micro-app projects created after the
        // migration ran.
    }
};

<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('magic_super_agent_workspaces', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_workspaces', 'is_pinned')) {
                $table->tinyInteger('is_pinned')->default(0)->comment('是否置顶：0-否，1-是')->after('is_archived');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_workspaces', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_workspaces', 'is_pinned')) {
                $table->dropColumn('is_pinned');
            }
        });
    }
};

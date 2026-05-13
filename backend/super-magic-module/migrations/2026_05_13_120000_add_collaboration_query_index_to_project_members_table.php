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
        Schema::table('magic_super_agent_project_members', function (Blueprint $table) {
            if (! Schema::hasIndex('magic_super_agent_project_members', 'idx_target_role_status_deleted_project')) {
                $table->index(
                    ['target_id', 'role', 'status', 'deleted_at', 'project_id'],
                    'idx_target_role_status_deleted_project'
                );
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_project_members', function (Blueprint $table) {
            if (Schema::hasIndex('magic_super_agent_project_members', 'idx_target_role_status_deleted_project')) {
                $table->dropIndex('idx_target_role_status_deleted_project');
            }
        });
    }
};

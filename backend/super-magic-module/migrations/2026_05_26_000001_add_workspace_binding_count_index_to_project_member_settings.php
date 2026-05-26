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
        Schema::table('magic_super_agent_project_member_settings', function (Blueprint $table) {
            if (! Schema::hasIndex('magic_super_agent_project_member_settings', 'idx_user_bind_workspace_project')) {
                $table->index(
                    ['user_id', 'is_bind_workspace', 'bind_workspace_id', 'project_id'],
                    'idx_user_bind_workspace_project'
                );
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_project_member_settings', function (Blueprint $table) {
            if (Schema::hasIndex('magic_super_agent_project_member_settings', 'idx_user_bind_workspace_project')) {
                $table->dropIndex('idx_user_bind_workspace_project');
            }
        });
    }
};

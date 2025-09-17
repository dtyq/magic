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
            // Add role field
            $table->string('role', 32)->default('')->comment('成员角色：owner-所有者，editor-编辑者，viewer-查看者')->after('target_id');

            // Add optimized index for main query (Phase 1)
            $table->index(['target_type', 'target_id', 'status', 'project_id'], 'idx_target_status');
        });
    }

    public function down(): void
    {
    }
};

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
            $table->tinyInteger('is_bind_workspace')->default(0)->comment('是否绑定到工作区：0-不绑定，1-绑定')->after('organization_code');
            // Add bind_workspace_id field
            $table->bigInteger('bind_workspace_id')->default(0)->comment('绑定的工作区ID')->after('is_bind_workspace');

            // Add optimized index for sorting performance (Phase 2)
            $table->index(['user_id', 'is_pinned', 'pinned_at', 'last_active_at'], 'idx_user_pin_sort');
        });
    }

    public function down(): void
    {
    }
};

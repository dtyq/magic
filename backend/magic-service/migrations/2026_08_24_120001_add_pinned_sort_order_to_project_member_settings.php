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
        if (Schema::hasTable('magic_super_agent_project_member_settings')
            && ! Schema::hasColumn('magic_super_agent_project_member_settings', 'pinned_sort_order')) {
            Schema::table('magic_super_agent_project_member_settings', function (Blueprint $table): void {
                $table->bigInteger('pinned_sort_order')->nullable()->comment('当前用户视角的置顶项目手工排序值，NULL表示未进入置顶手工排序区');
            });
        }
    }

    public function down(): void
    {
    }
};

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
        Schema::create('magic_super_agent_project_member_settings', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键');
            $table->string('user_id', 36)->comment('用户ID');
            $table->bigInteger('project_id')->comment('项目ID');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->tinyInteger('is_pinned')->default(0)->comment('是否置顶：0-否，1-是');
            $table->timestamp('pinned_at')->nullable()->comment('置顶时间');
            $table->timestamp('last_active_at')->useCurrent()->comment('最后活跃时间');
            $table->timestamps();

            $table->index(['user_id', 'project_id'], 'idx_user_project');
            $table->index('project_id', 'idx_project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_project_member_settings');
    }
};

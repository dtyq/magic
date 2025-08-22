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
        Schema::create('magic_super_agent_project_members', function (Blueprint $table) {
            $table->bigIncrements('id')->comment('主键');
            $table->bigInteger('project_id')->comment('项目ID');
            $table->string('target_type', 32)->comment('成员类型：User/Department');
            $table->string('target_id', 128)->comment('成员ID（用户ID或部门ID）');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->tinyInteger('status')->default(1)->comment('状态：1-激活，0-非激活');
            $table->string('invited_by', 128)->comment('邀请人用户ID');
            $table->timestamps();

            // 唯一约束：防止重复添加成员
            $table->unique(['project_id', 'target_type', 'target_id'], 'uk_project_target');

            // 索引优化
            $table->index('invited_by', 'idx_invited_by');
            $table->index(['target_type', 'target_id'], 'idx_target');
            $table->index('created_at', 'idx_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_project_members');
    }
};

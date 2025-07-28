<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_long_term_memories', function (Blueprint $table) {
            $table->string('id', 36)->primary()->comment('记忆唯一ID');
            $table->text('content')->comment('记忆内容');
            $table->text('pending_content')->nullable()->comment('待变更的记忆内容，等待用户接受变更');
            $table->text('explanation')->nullable()->comment('记忆解释，说明这条记忆为什么值得记录');
            $table->text('origin_text')->nullable()->comment('原始文本内容');
            $table->string('memory_type', 50)->default('manual_input')->comment('记忆类型');
            $table->string('status', 20)->default('pending')->comment('记忆状态：pending-待接受, active-已生效, pending_revision-待修订');
            $table->tinyInteger('enabled')->default(0)->comment('是否启用：0-禁用，1-启用（仅 active 状态的记忆可以设置）');
            $table->decimal('confidence', 3, 2)->unsigned()->default(0.8)->comment('置信度(0-1)');
            $table->decimal('importance', 3, 2)->unsigned()->default(0.5)->comment('重要性(0-1)');
            $table->unsignedInteger('access_count')->default(0)->comment('访问次数');
            $table->unsignedInteger('reinforcement_count')->default(0)->comment('强化次数');
            $table->decimal('decay_factor', 3, 2)->unsigned()->default(1.0)->comment('衰减因子(0-1)');
            $table->json('tags')->nullable()->comment('标签列表');
            $table->json('metadata')->nullable()->comment('元数据');
            $table->string('org_id', 36)->comment('组织ID');
            $table->string('app_id', 36)->comment('应用ID');
            $table->string('project_id', 36)->nullable()->default(null)->comment('项目ID');
            $table->string('user_id', 36)->comment('用户ID');
            $table->timestamp('last_accessed_at')->nullable()->comment('最后访问时间');
            $table->timestamp('last_reinforced_at')->nullable()->comment('最后强化时间');
            $table->timestamp('expires_at')->nullable()->comment('过期时间');
            $table->timestamp('created_at')->useCurrent()->comment('创建时间');
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->comment('更新时间');
            $table->softDeletes()->comment('删除时间');
            // 索引
            $table->index(['org_id', 'app_id', 'user_id', 'project_id', 'last_accessed_at'], 'idx_user_last_accessed');
            $table->index(['org_id', 'app_id', 'user_id', 'project_id', 'importance'], 'idx_user_importance');
            $table->index(['expires_at', 'deleted_at'], 'idx_expires_deleted');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_long_term_memories');
    }
};

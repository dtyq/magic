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
        if (Schema::hasTable('magic_super_agent_warm_pool_sandboxes')) {
            return;
        }
        Schema::create('magic_super_agent_warm_pool_sandboxes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('sandbox_id', 64)->unique()->comment('沙箱ID');
            $table->string('sandbox_name', 128)->comment('沙箱名字');
            $table->string('agent_image', 256)->comment('该 sandbox 跑的 agent 镜像，image 切版本时整池失效');
            $table->string('status', 32)->comment('creating | ready | claimed | dead');
            $table->string('bound_user_id', 64)->nullable()->comment('被 claim 时的 user_id（用于 trace）');
            $table->string('bound_project_id', 64)->nullable()->comment('被 claim 时的 project_id（用于 trace）');
            $table->dateTime('bound_at')->nullable()->comment('mount 成功的时间');
            $table->dateTime('expires_at')->comment('软上限，到期 evict');
            $table->string('dead_reason', 256)->nullable()->comment('死亡原因');
            $table->timestamps();

            $table->index(['status', 'agent_image'], 'idx_status_image');
            $table->index('expires_at', 'idx_expires');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_warm_pool_sandboxes');
    }
};

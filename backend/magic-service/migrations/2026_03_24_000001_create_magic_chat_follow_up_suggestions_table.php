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
        if (Schema::hasTable('magic_super_agent_message_suggestions')) {
            return;
        }

        Schema::create('magic_super_agent_message_suggestions', static function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary()->comment('追问推荐记录ID (雪花ID)');
            $table->unsignedBigInteger('topic_id')->default(0)->comment('话题ID');
            $table->string('task_id', 64)->comment('问题对应的任务ID');
            $table->json('suggestions')->nullable()->comment('推荐问题列表 JSON');
            $table->tinyInteger('status')->default(0)->comment('状态: 0-generating, 1-done, 2-failed');
            $table->timestamps();

            $table->unique('task_id', 'uk_task_id');
            $table->index(['topic_id', 'task_id'], 'idx_topic_task');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_message_suggestions');
    }
};

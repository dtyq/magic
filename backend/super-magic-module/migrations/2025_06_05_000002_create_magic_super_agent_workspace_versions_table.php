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
        if (Schema::hasTable('magic_super_agent_workspace_versions')) {
            return;
        }
        Schema::create('magic_super_agent_workspace_versions', function (Blueprint $table) {
            $table->unsignedBigInteger('id');
            $table->unsignedBigInteger('topic_id')->comment('话题id。');
            $table->string('sandbox_id', 255)->comment('沙箱id。');
            $table->string('commit_hash', 255)->comment('commit hash。');
            $table->text('dir')->comment('话题文件列表');
            $table->string('folder', 255)->comment('文件夹');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_workspace_versions');
    }
};

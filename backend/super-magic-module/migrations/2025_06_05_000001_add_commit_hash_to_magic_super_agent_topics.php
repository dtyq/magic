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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->string('workspace_commit_hash', 255)->default('')->comment('当前的提交的workspace commit hash');
            $table->string('chat_history_commit_hash', 255)->default('')->comment('当前的提交的chat_history commit hash');
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropColumn('workspace_commit_hash');
            $table->dropColumn('chat_history_commit_hash');
        });
    }
};

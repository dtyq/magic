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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'task_mode')) {
                $table->string('task_mode', 50)->default('chat')->comment('聊天模式: chat-聊天模式, plan-规划模式');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_topics', 'task_mode')) {
                $table->dropColumn('task_mode');
            }
        });
    }
};

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
        if (Schema::hasTable('magic_super_agent_topics')
            && Schema::hasColumn('magic_super_agent_topics', 'topic_name')) {
            Schema::table('magic_super_agent_topics', function (Blueprint $table): void {
                $table->string('topic_name', 255)->default('')->comment('话题名称')->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('magic_super_agent_topics')
            && Schema::hasColumn('magic_super_agent_topics', 'topic_name')) {
            Schema::table('magic_super_agent_topics', function (Blueprint $table): void {
                $table->string('topic_name', 64)->default('')->comment('话题名称')->change();
            });
        }
    }
};

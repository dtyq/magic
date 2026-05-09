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
            if (! Schema::hasColumn('magic_super_agent_topics', 'is_pinned')) {
                $table->boolean('is_pinned')->default(false)->comment('是否置顶')->after('updated_uid');
            }
            if (! Schema::hasColumn('magic_super_agent_topics', 'is_archived')) {
                $table->boolean('is_archived')->default(false)->comment('是否归档')->after('is_pinned');
            }
            if (! Schema::hasColumn('magic_super_agent_topics', 'last_read_at')) {
                $table->dateTime('last_read_at')->nullable()->comment('最后阅读时间')->after('is_archived');
            }
            if (! Schema::hasColumn('magic_super_agent_topics', 'last_read_message_id')) {
                $table->unsignedBigInteger('last_read_message_id')->nullable()->comment('最后已读消息ID')->after('last_read_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $dropColumns = [];
            foreach (['is_pinned', 'is_archived', 'last_read_at', 'last_read_message_id'] as $column) {
                if (Schema::hasColumn('magic_super_agent_topics', $column)) {
                    $dropColumns[] = $column;
                }
            }

            if (! empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};

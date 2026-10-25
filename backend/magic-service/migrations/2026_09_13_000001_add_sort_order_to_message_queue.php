<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('magic_super_agent_message_queue', function (Blueprint $table): void {
            $table->bigInteger('sort_order')->default(0)->comment('待发送队列顺序，与创建时间和补偿资格无关');
            $table->index(['topic_id', 'status', 'deleted_at', 'sort_order', 'id'], 'idx_topic_queue_order');
        });
        Db::table('magic_super_agent_message_queue')->update(['sort_order' => Db::raw('id')]);
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_message_queue', function (Blueprint $table): void {
            $table->dropIndex('idx_topic_queue_order');
            $table->dropColumn('sort_order');
        });
    }
};

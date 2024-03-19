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
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_message', 'im_seq_id')) {
                $table->bigInteger('im_seq_id')->nullable()->comment('消息序列ID，用于消息顺序追踪');
            }

            $sm = Schema::getConnection()->getDoctrineSchemaManager();
            $indexes = $sm->listTableIndexes('magic_super_agent_message');
            if (! isset($indexes['idx_im_seq_id'])) {
                $table->index(['im_seq_id'], 'idx_im_seq_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

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
            // Add im_seq_id field for message sequence tracking
            $table->bigInteger('im_seq_id')->nullable()->comment('消息序列ID，用于消息顺序追踪');

            // Add index for performance optimization
            $table->index(['im_seq_id'], 'idx_im_seq_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_im_seq_id');
            // Drop the column
            $table->dropColumn('im_seq_id');
        });
    }
};

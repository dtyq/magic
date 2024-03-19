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
            // Add parent_correlation_id field for parent message correlation tracking
            $table->string('parent_correlation_id', 128)->nullable()->comment('父级关联ID，用于建立消息的父子关系');

            // Add content_type field for message content type identification
            $table->string('content_type', 64)->nullable()->comment('内容类型，如reasoning、content等');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            // Drop the columns
            $table->dropColumn(['parent_correlation_id', 'content_type']);
        });
    }
};

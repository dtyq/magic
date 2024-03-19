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
        if (Schema::hasColumn('magic_chat_messages', 'current_version_id')) {
            return;
        }
        Schema::table('magic_chat_messages', function (Blueprint $table) {
            $table->bigInteger('current_version_id')->nullable()->comment('当前消息版本id')->default(null);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_chat_messages', function (Blueprint $table) {
            $table->dropColumn('current_version_id');
        });
    }
};

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
        Schema::table('magic_chat_sequences', function (Blueprint $table) {
            if (! Schema::hasIndex('magic_chat_sequences', 'idx_object_type_object_id_app_message_id')) {
                $table->index(['object_type', 'object_id', 'app_message_id'], 'idx_object_type_object_id_app_message_id');
            }
        });
    }

    public function down(): void
    {
    }
};

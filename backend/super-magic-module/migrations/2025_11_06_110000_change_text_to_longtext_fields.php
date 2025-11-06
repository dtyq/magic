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
        // Change magic_super_agent_message table fields from text to longtext
        Schema::table('magic_super_agent_message', function (Blueprint $table) {
            $table->longText('content')->change();
            $table->longText('raw_content')->nullable()->change();
        });

        // Change magic_super_agent_task table field from text to longtext
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            $table->longText('prompt')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

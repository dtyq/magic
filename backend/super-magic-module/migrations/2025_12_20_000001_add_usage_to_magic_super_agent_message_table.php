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
            // Add usage field for storing usage information (only set when task is finished)
            if (! Schema::hasColumn('magic_super_agent_message', 'usage')) {
                $table->json('usage')->nullable()->comment('Usage information array (token usage, API calls, etc.), only set when task is finished');
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

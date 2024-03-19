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
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            $table->timestamp('started_at')->nullable()->comment('Task start time');
            $table->timestamp('finished_at')->nullable()->comment('Task finish time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

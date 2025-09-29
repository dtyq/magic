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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->tinyInteger('source')->default(1)->after('cost')->comment('Creation source: 1=user_created, 2=scheduled_task');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

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
            $table->string('agent_code', 64)->default('')->comment('Agent code for custom agent mode')->after('topic_mode');
        });

        echo 'Added agent_code field to topics table' . PHP_EOL;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropColumn('agent_code');
        });

        echo 'Dropped agent_code field from topics table' . PHP_EOL;
    }
};

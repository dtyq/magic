<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddCostToMagicSuperAgentTopicsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->decimal('cost', 10, 4)->default(0.0000)->comment('Topic cost amount')->after('task_mode');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            $table->dropColumn('cost');
        });
    }
}

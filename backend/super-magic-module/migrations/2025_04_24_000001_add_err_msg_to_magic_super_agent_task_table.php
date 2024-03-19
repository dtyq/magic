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
            if (! Schema::hasColumn('magic_super_agent_task', 'err_msg')) {
                $table->string('err_msg', 500)->nullable()->comment('错误信息');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_task', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_task', 'err_msg')) {
                $table->dropColumn('err_msg');
            }
        });
    }
};

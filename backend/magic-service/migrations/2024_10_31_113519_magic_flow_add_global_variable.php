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
        Schema::table('magic_flows', function (Blueprint $table) {
            $table->json('global_variable')->nullable()->comment('全局变量')->after('nodes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

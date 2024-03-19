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
        Schema::table('magic_bots', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_bots', 'start_page')) {
                $table->boolean('start_page')->default(false)->comment('启动页开关');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_bots', function (Blueprint $table) {
            $table->dropColumn('start_page');
        });
    }
};

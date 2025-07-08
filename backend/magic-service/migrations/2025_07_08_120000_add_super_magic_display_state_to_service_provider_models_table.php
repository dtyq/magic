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
        if (! Schema::hasColumn('service_provider_models', 'super_magic_display_state')) {
            Schema::table('service_provider_models', function (Blueprint $table) {
                $table->tinyInteger('super_magic_display_state')->default(0)->comment('超级麦吉显示开关：0-关闭，1-开启');
            });
        }
    }
};

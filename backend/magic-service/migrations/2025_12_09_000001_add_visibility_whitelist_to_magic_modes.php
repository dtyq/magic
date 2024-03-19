<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('magic_modes', function (Blueprint $table) {
            $table->json('visibility_whitelist')
                ->nullable()
                ->comment('可见性白名单，含organizations');
        });
    }

    public function down(): void
    {
        Schema::table('magic_modes', function (Blueprint $table) {
        });
    }
};

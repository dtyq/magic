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
        Schema::table('magic_flow_memory_histories', function (Blueprint $table) {
            $table->string('mount_id', 80)->default('')->nullable(false)->comment('挂载ID')->index()->after('content');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

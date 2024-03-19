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
        Schema::table('magic_environments', function (Blueprint $table) {
            $table->text('extra')->nullable()->comment('扩展字段，比如记录一下这个环境关联的环境 id。（预发布和生产是关联的）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

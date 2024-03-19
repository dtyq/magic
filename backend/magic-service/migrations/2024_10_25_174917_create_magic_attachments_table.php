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
        if (Schema::hasTable('magic_attachments')) {
            return;
        }
        Schema::create('magic_attachments', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('target_id');
            $table->unsignedTinyInteger('target_type')->comment('0-未知1-待办');
            $table->string('uid', 64);
            $table->text('key');
            $table->text('name');
            $table->unsignedTinyInteger('origin_type')->comment('上传来源：0-无1-图片组件2-文件组件')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->string('organization_code')->index()->comment('组织code');

            $table->index(['target_id', 'target_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};

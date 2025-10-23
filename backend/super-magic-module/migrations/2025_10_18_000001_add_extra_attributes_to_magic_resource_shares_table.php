<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/**
 * 为资源分享表添加额外属性字段.
 */
class AddExtraAttributesToMagicResourceSharesTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_resource_shares', function (Blueprint $table) {
            // 添加 extra JSON 字段，用于存储资源分享的额外属性
            $table->json('extra')
                ->nullable()
                ->comment('额外属性（JSON格式）')
                ->after('target_ids');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
}

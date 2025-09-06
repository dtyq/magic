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
        Schema::create('magic_flow_cache', function (Blueprint $table) {
            $table->id();
            $table->string('cache_hash', 32)->unique()->comment('缓存键MD5哈希值(cache_prefix+cache_key)');
            $table->string('cache_prefix')->comment('缓存前缀');
            $table->string('cache_key')->comment('缓存键名');
            $table->string('scope_tag', 10)->comment('作用域标识');
            $table->longText('cache_value')->comment('缓存值内容');
            $table->unsignedInteger('ttl_seconds')->default(7200)->comment('TTL秒数（0代表永久缓存）');
            $table->timestamp('expires_at')->comment('过期时间戳');
            $table->string('organization_code', 64)->comment('组织隔离');
            $table->string('created_uid', 64)->default('')->comment('创建人');
            $table->string('updated_uid', 64)->default('')->comment('更新人');
            $table->timestamps();

            // 索引 - 使用MD5哈希值作为主要查询索引
            $table->unique('cache_hash', 'uk_cache_hash');
            $table->index('expires_at', 'idx_expires_at');
            $table->index('organization_code', 'idx_organization_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_cache');
    }
};

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
        if (Schema::hasTable('magic_generated_suggestions')) {
            return;
        }

        Schema::create('magic_generated_suggestions', static function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary()->comment('生成建议记录ID (雪花ID)');
            $table->unsignedTinyInteger('type')->default(0)->comment('建议类型: 1-super_magic_topic_followup');
            $table->string('relation_key1', 64)->default('')->comment('一级关联键, type=1(super_magic_topic_followup)时表示topic_id');
            $table->string('relation_key2', 64)->default('')->comment('二级关联键, type=1(super_magic_topic_followup)时表示task_id');
            $table->string('relation_key3', 64)->default('')->comment('三级关联键, type=1(super_magic_topic_followup)时预留扩展');
            $table->json('params')->nullable()->comment('生成来源与上下文参数 JSON');
            $table->json('suggestions')->nullable()->comment('生成结果 JSON');
            $table->unsignedTinyInteger('status')->default(0)->comment('状态: 0-generating, 1-done, 2-failed');
            $table->string('created_uid', 64)->nullable()->comment('创建人UID');
            $table->timestamps();

            $table->unique(['type', 'relation_key1', 'relation_key2', 'relation_key3'], 'uk_type_relation_keys');
            $table->index(['type', 'relation_key1', 'relation_key2'], 'idx_type_relation_key12');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_generated_suggestions');
    }
};

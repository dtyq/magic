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
        Schema::create('magic_user_id_relation', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 64)->comment('用户id,组织下唯一.其他open_id,union_id需要根据user_id生成')->default('');
            $table->string('id_type', 12)->comment('id类型:open_id/union_id')->default('');
            $table->string('id_value', 64)->comment('id类型对应的值')->default('');
            $table->string('relation_type', 12)->comment('id对应的关联类型:应用编码/创建该应用的组织编码')->default('');
            $table->string('relation_value', 64)->comment('id对应的关联类型的值')->default('');
            // 确定唯一值,防冲突
            $table->unique(['id_type', 'id_value', 'relation_type', 'relation_value'], 'unq_id_relation');
            // 便于按组织/应用等查找所有关联的用户
            $table->index(['relation_type', 'relation_value'], 'idx_relation');
            $table->index(['user_id'], 'idx_user_id');
            $table->comment('用户id关联表. 记录 user_id 与 open_id/union_id等的关联');
            $table->datetimes();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_user_id_relation');
    }
};

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
        // 重命名表 magic_token->magic_tokens
        if (Schema::hasTable('magic_token')) {
            Schema::rename('magic_token', 'magic_tokens');
        }
        Schema::table('magic_tokens', static function (Blueprint $table) {
            $table->string('type_relation_value', 255)->comment(
                'token类型对应的值.类型为0时,此值为account_id;类型为1时,此值为user_id;类型为2时,此值为组织编码;类型为3时,此值为app_id;类型为4时,此值为flow_id'
            )->default('')->change();
            // 判断 idx_token 是否存在
            if (Schema::hasIndex('magic_tokens', 'idx_token')) {
                $table->dropIndex('idx_token');
            }
            if (! Schema::hasIndex('magic_tokens', 'unq_token_type')) {
                $table->unique(['token', 'type'], 'unq_token_type');
            }
            if (! Schema::hasIndex('magic_tokens', 'idx_type_relation_value_expired_at')) {
                $table->index(['type', 'type_relation_value', 'expired_at'], 'idx_type_relation_value_expired_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_tokens');
    }
};

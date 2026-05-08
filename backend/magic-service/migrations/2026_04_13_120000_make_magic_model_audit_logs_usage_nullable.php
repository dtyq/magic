<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;
use Hyperf\DbConnection\Db;

return new class extends Migration {
    /**
     * Run the migrations.
     * 允许 usage 为 NULL：计费侧仅写 points 占位插入时不再依赖 Model 默认 attributes。
     */
    public function up(): void
    {
        if (! Schema::hasTable('magic_model_audit_logs') || ! Schema::hasColumn('magic_model_audit_logs', 'usage')) {
            return;
        }

        if ($this->isUsageNullable()) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            $table->json('usage')->nullable()->comment('花费信息(token或次数)')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('magic_model_audit_logs') || ! Schema::hasColumn('magic_model_audit_logs', 'usage')) {
            return;
        }

        Db::table('magic_model_audit_logs')->whereNull('usage')->update(['usage' => '[]']);

        if (! $this->isUsageNullable()) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            $table->json('usage')->nullable(false)->comment('花费信息(token或次数)')->change();
        });
    }

    private function isUsageNullable(): bool
    {
        $column = Db::selectOne(
            'SELECT IS_NULLABLE AS is_nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
            ['magic_model_audit_logs', 'usage']
        );

        if ($column === null) {
            return false;
        }

        $isNullable = is_array($column) ? ($column['is_nullable'] ?? null) : $column->is_nullable;

        return strtoupper((string) $isNullable) === 'YES';
    }
};

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
        if (! Schema::hasTable('magic_model_audit_logs')) {
            return;
        }

        Schema::table('magic_model_audit_logs', function (Blueprint $table) {
            if (! Schema::hasIndex('magic_model_audit_logs', 'idx_magic_model_audit_logs_product_code')) {
                $table->index('product_code', 'idx_magic_model_audit_logs_product_code');
            }
        });
    }

    public function down(): void
    {
        // no-op: index removal is intentionally handled separately for online changes.
    }
};

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
        if (Schema::hasTable('magic_resource_shares') && ! Schema::hasColumn('magic_resource_shares', 'scope_version')) {
            Schema::table('magic_resource_shares', static function (Blueprint $table): void {
                $table->unsignedBigInteger('scope_version')->default(1)->comment('分享范围递增版本');
            });
        }
        if (Schema::hasTable('magic_file_collections') && ! Schema::hasColumn('magic_file_collections', 'scope_version')) {
            Schema::table('magic_file_collections', static function (Blueprint $table): void {
                $table->unsignedBigInteger('scope_version')->default(1)->comment('文件集范围递增版本');
            });
        }
    }

    public function down(): void
    {
    }
};

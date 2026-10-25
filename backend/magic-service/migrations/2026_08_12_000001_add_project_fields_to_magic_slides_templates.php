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
        if (! Schema::hasTable('magic_slides_templates')) {
            return;
        }

        Schema::table('magic_slides_templates', static function (Blueprint $table): void {
            if (! Schema::hasColumn('magic_slides_templates', 'project_id')) {
                $table->unsignedBigInteger('project_id')->nullable()->default(null)->after('owner_id')->comment('来源项目 ID');
            }
            if (! Schema::hasColumn('magic_slides_templates', 'project_directory_id')) {
                $table->unsignedBigInteger('project_directory_id')->nullable()->default(null)->after('project_id')->comment('来源项目工作区目录 file_id');
            }
        });

        Schema::table('magic_slides_templates', static function (Blueprint $table): void {
            if (! Schema::hasIndex('magic_slides_templates', 'idx_project_directory_id')) {
                $table->index(['project_id', 'project_directory_id'], 'idx_project_directory_id');
            }
        });
    }

    public function down(): void
    {
    }
};

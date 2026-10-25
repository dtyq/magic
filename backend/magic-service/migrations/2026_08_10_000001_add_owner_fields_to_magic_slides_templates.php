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
    public function up(): void
    {
        if (! Schema::hasTable('magic_slides_templates')) {
            return;
        }

        Schema::table('magic_slides_templates', static function (Blueprint $table): void {
            if (! Schema::hasColumn('magic_slides_templates', 'owner_type')) {
                $table->string('owner_type', 16)->default('OFFICIAL')->after('organization_code')->comment('所有权类型');
            }
            if (! Schema::hasColumn('magic_slides_templates', 'owner_id')) {
                $table->string('owner_id', 64)->nullable()->default(null)->after('owner_type')->comment('所有者 ID');
            }
        });

        Db::table('magic_slides_templates')
            ->whereNull('owner_id')
            ->update([
                'owner_type' => 'OFFICIAL',
                'owner_id' => Db::raw('organization_code'),
            ]);

        Schema::table('magic_slides_templates', static function (Blueprint $table): void {
            if (! Schema::hasIndex('magic_slides_templates', 'idx_org_owner_type_owner_id_status_id')) {
                $table->index(
                    ['organization_code', 'owner_type', 'owner_id', 'status', 'id'],
                    'idx_org_owner_type_owner_id_status_id'
                );
            }
        });
    }

    public function down(): void
    {
    }
};

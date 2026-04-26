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
        if (! Schema::hasTable('magic_model_access_role_users')) {
            return;
        }

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_model_access_role_users', 'principal_type')) {
                $table->unsignedTinyInteger('principal_type')->nullable()->after('role_id')->comment('绑定主体类型: 1=用户,2=部门,3=组织');
            }

            if (! Schema::hasColumn('magic_model_access_role_users', 'principal_id')) {
                $table->string('principal_id', 64)->nullable()->after('principal_type')->comment('绑定主体ID');
            }
        });

        Db::table('magic_model_access_role_users')
            ->whereNull('principal_type')
            ->update([
                'principal_type' => 1,
                'principal_id' => Db::raw('user_id'),
            ]);

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            $table->index(['organization_code', 'principal_type', 'principal_id'], 'idx_org_principal');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_model_access_role_users')) {
            return;
        }

        Schema::table('magic_model_access_role_users', static function (Blueprint $table) {
            if (Schema::hasColumn('magic_model_access_role_users', 'principal_id')) {
                $table->dropIndex('idx_org_principal');
                $table->dropColumn('principal_id');
            }

            if (Schema::hasColumn('magic_model_access_role_users', 'principal_type')) {
                $table->dropColumn('principal_type');
            }
        });
    }
};

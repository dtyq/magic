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
        Schema::table('magic_bots', function (Blueprint $table) {
            $table->string('code', 64)->nullable()->comment('助理编码')->after('flow_code');
            $table->unique(['organization_code', 'code'], 'uniq_magic_bots_org_code');
        });
    }

    public function down(): void
    {
        Schema::table('magic_bots', function (Blueprint $table) {
            $table->dropUnique('uniq_magic_bots_org_code');
            $table->dropColumn('code');
        });
    }
};

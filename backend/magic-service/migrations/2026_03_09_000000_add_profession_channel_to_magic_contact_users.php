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
        Schema::table('magic_contact_users', static function (Blueprint $table) {
            $table->string('profession', 64)->nullable()->default(null)->comment('职业身份');
            $table->string('channel', 64)->nullable()->default(null)->comment('获知渠道');
        });
    }

    public function down(): void
    {
        Schema::table('magic_contact_users', static function (Blueprint $table) {
            $table->dropColumn(['profession', 'channel']);
        });
    }
};

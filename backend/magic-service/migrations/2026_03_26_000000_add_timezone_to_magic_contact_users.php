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
            $table->string('timezone', 64)->nullable()->default(null)->comment('用户所在时区(IANA)');
        });
    }

    public function down(): void
    {
        Schema::table('magic_contact_users', static function (Blueprint $table) {
            $table->dropColumn(['timezone']);
        });
    }
};

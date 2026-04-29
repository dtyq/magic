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
        Schema::table('magic_contact_users', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_contact_users', 'preferences')) {
                $table->json('preferences')->nullable()->comment('用户偏好设置，JSON 格式');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

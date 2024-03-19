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
        // Ensure the table exists before attempting to modify it
        if (! Schema::hasTable('magic_contact_department_users')) {
            return;
        }

        Schema::table('magic_contact_department_users', static function (Blueprint $table) {
            // Increase the job_title column length from 64 to 256
            $table->string('job_title', 256)
                ->comment('在此部门的职位')
                ->default('')
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert the job_title column length back to 64
        if (! Schema::hasTable('magic_contact_department_users')) {
            return;
        }

        Schema::table('magic_contact_department_users', static function (Blueprint $table) {
            $table->string('job_title', 64)
                ->comment('在此部门的职位')
                ->default('')
                ->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The role enum only allowed applicant / ai_assistant, so interviewer
     * messages were stored as applicant and fed to the AI as candidate answers.
     */
    public function up(): void
    {
        Schema::table('interview_messages', function (Blueprint $table) {
            $table->string('role', 20)->change();
        });

        // On PostgreSQL the enum is a CHECK constraint that ->change() leaves in place
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE interview_messages DROP CONSTRAINT IF EXISTS interview_messages_role_check');
        }
    }

    public function down(): void
    {
        DB::table('interview_messages')->where('role', 'interviewer')->update(['role' => 'applicant']);

        // Laravel cannot ->change() a column to enum on PostgreSQL, so restore the CHECK directly
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE interview_messages DROP CONSTRAINT IF EXISTS interview_messages_role_check');
            DB::statement("ALTER TABLE interview_messages ADD CONSTRAINT interview_messages_role_check CHECK (role IN ('applicant', 'ai_assistant'))");

            return;
        }

        Schema::table('interview_messages', function (Blueprint $table) {
            $table->enum('role', ['applicant', 'ai_assistant'])->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('interview_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_room_id')->constrained()->cascadeOnDelete();
            $table->string('room_code', 10)->index();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('role', ['applicant', 'ai_assistant']);
            $table->text('message');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interview_messages');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            // SHA-256 of the per-room cookie token; the token itself is never stored
            $table->string('token_hash', 64);
            $table->timestamp('joined_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['interview_room_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_participants');
    }
};

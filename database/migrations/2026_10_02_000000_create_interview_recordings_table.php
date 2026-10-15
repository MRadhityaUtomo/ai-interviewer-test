<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_room_id')
                ->constrained('interview_rooms')
                ->cascadeOnDelete();
            $table->string('room_code')->index();
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type')->default('video/webm');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('status')->default('ready');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_recordings');
    }
};

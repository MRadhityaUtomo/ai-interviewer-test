<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class InterviewRecording extends Model
{
    protected $fillable = [
        'interview_room_id',
        'room_code',
        'user_id',
        'file_path',
        'file_name',
        'mime_type',
        'size_bytes',
        'duration_seconds',
        'status',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'duration_seconds' => 'integer',
    ];

    protected $appends = [
        'url',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(InterviewRoom::class, 'interview_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getUrlAttribute(): string
    {
        return route('recordings.stream', $this->id);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InterviewRoom extends Model
{
    protected $fillable = [
        'room_code',
        'status',
        'user_id',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recordings()
    {
        return $this->hasMany(InterviewRecording::class, 'interview_room_id');
    }

    public function messages()
    {
        return $this->hasMany(InterviewMessage::class, 'interview_room_id');
    }
}
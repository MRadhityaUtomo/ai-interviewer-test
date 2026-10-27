<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InterviewMessage extends Model
{
    protected $fillable = [
        'interview_room_id',
        'room_code',
        'user_id',
        'role',
        'message',
    ];

    protected $casts = [
        'role' => 'string',
    ];

    public function room()
    {
        return $this->belongsTo(InterviewRoom::class, 'interview_room_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

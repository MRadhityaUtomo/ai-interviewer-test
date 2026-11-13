<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A user's seat in an interview room, proven by the per-room cookie.
 *
 * @property int $id
 * @property int $interview_room_id
 * @property int $user_id
 * @property string $role
 * @property string $token_hash
 * @property Carbon $joined_at
 * @property Carbon|null $revoked_at
 */
class InterviewParticipant extends Model
{
    protected $fillable = [
        'interview_room_id',
        'user_id',
        'role',
        'token_hash',
        'joined_at',
        'revoked_at',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<InterviewRoom, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(InterviewRoom::class, 'interview_room_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

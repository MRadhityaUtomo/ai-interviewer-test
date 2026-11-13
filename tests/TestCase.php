<?php

namespace Tests;

use App\Models\InterviewRoom;
use App\Services\RoomAccessService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * Open the room page as the acting user and keep the per-room participant
     * cookie it hands out for the following requests.
     */
    protected function enterRoom(InterviewRoom $room): static
    {
        $response = $this->get(route('rooms.show', $room->room_code))->assertOk();

        $cookie = $response->getCookie(RoomAccessService::COOKIE);

        if ($cookie !== null) {
            $this->withCookie(RoomAccessService::COOKIE, (string) $cookie->getValue());
        }

        // JSON test requests only send cookies with credentials enabled, like fetch()
        return $this->withCredentials();
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}

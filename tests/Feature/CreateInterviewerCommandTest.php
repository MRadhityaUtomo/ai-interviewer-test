<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CreateInterviewerCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_verified_interviewer_from_options(): void
    {
        $this->artisan('interviewer:create', [
            '--name' => 'Rina HR',
            '--email' => 'rina@example.com',
            '--password' => 'rahasia123',
        ])->assertSuccessful();

        $user = User::where('email', 'rina@example.com')->firstOrFail();
        $this->assertSame('interviewer', $user->role);
        $this->assertSame('Rina HR', $user->name);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('rahasia123', $user->password));
    }

    public function test_it_prompts_for_missing_values(): void
    {
        $this->artisan('interviewer:create')
            ->expectsQuestion('Email', 'budi@example.com')
            ->expectsQuestion('Nama', 'Budi')
            ->expectsQuestion('Password', 'rahasia123')
            ->assertSuccessful();

        $this->assertSame('interviewer', User::where('email', 'budi@example.com')->value('role'));
    }

    public function test_it_rejects_a_short_password(): void
    {
        $this->artisan('interviewer:create', [
            '--name' => 'Rina',
            '--email' => 'rina@example.com',
            '--password' => 'short',
        ])->assertFailed();

        $this->assertDatabaseMissing('users', ['email' => 'rina@example.com']);
    }

    public function test_it_refuses_an_existing_email_without_promote(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);

        $this->artisan('interviewer:create', ['--email' => $applicant->email, '--no-interaction' => true])
            ->assertFailed();

        $this->assertSame('applicant', $applicant->fresh()->role);
    }

    public function test_it_promotes_an_existing_user_with_promote(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);

        $this->artisan('interviewer:create', ['--email' => $applicant->email, '--promote' => true])
            ->assertSuccessful();

        $this->assertSame('interviewer', $applicant->fresh()->role);
    }

    public function test_it_promotes_after_interactive_confirmation(): void
    {
        $applicant = User::factory()->create(['role' => 'applicant']);

        $this->artisan('interviewer:create', ['--email' => $applicant->email])
            ->expectsConfirmation("{$applicant->email} sudah terdaftar sebagai applicant. Jadikan interviewer?", 'yes')
            ->assertSuccessful();

        $this->assertSame('interviewer', $applicant->fresh()->role);
    }
}

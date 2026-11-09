<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

/**
 * Registration always creates applicants, so interviewer accounts are made here.
 */
class CreateInterviewer extends Command
{
    protected $signature = 'interviewer:create
        {--name= : Full name}
        {--email= : Login email}
        {--password= : Password (prompted when omitted)}
        {--promote : Turn an existing account with this email into an interviewer}';

    protected $description = 'Create an interviewer account, or promote an existing user to interviewer';

    public function handle(): int
    {
        $email = $this->option('email') ?: text(
            label: 'Email',
            required: true,
            validate: fn (string $value) => filter_var($value, FILTER_VALIDATE_EMAIL) ? null : 'Email tidak valid.',
        );

        $existing = User::where('email', $email)->first();

        if ($existing) {
            return $this->promote($existing);
        }

        $data = [
            'name' => $this->option('name') ?: text(label: 'Nama', required: true),
            'email' => $email,
            'password' => $this->option('password') ?: password(
                label: 'Password',
                required: true,
                hint: 'Minimal 8 karakter.',
            ),
        ];

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', Password::default()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create([...$validator->validated(), 'role' => 'interviewer']);
        // Accounts created by an admin are trusted; skip the email verification step
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->components->info("Akun interviewer dibuat: {$user->email}");

        return self::SUCCESS;
    }

    private function promote(User $user): int
    {
        if ($user->role === 'interviewer') {
            $this->components->info("{$user->email} sudah menjadi interviewer.");

            return self::SUCCESS;
        }

        $confirmed = $this->option('promote') || ($this->input->isInteractive() && confirm(
            label: "{$user->email} sudah terdaftar sebagai {$user->role}. Jadikan interviewer?",
            default: false,
        ));

        if (! $confirmed) {
            $this->components->error("Email {$user->email} sudah dipakai. Gunakan --promote untuk menjadikannya interviewer.");

            return self::FAILURE;
        }

        $user->forceFill(['role' => 'interviewer'])->save();

        $this->components->info("{$user->email} sekarang menjadi interviewer.");

        return self::SUCCESS;
    }
}

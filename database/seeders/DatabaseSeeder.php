<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'interviewer@test.com'],
            [
                'name' => 'Demo Interviewer',
                'password' => 'password',
                'role' => 'interviewer',
                'email_verified_at' => now(),
            ],
        );

        User::updateOrCreate(
            ['email' => 'applicant@test.com'],
            [
                'name' => 'Demo Applicant',
                'password' => 'password',
                'role' => 'applicant',
                'email_verified_at' => now(),
            ],
        );
    }
}

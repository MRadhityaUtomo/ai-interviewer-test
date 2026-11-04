<?php

namespace App\Providers;

use App\Services\Ai\AiProviderInterface;
use App\Services\Ai\FakeAiProvider;
use App\Services\Ai\QwenProvider;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(AiProviderInterface::class, fn (): AiProviderInterface => match (config('services.ai.provider')) {
            'qwen' => new QwenProvider(
                apiKey: config('services.qwen.api_key'),
                baseUrl: config('services.qwen.base_url'),
                model: config('services.qwen.model'),
                timeout: config('services.qwen.timeout'),
            ),
            default => new FakeAiProvider,
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}

<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'ai' => [
        // "fake" (offline dummy replies), "ollama" (local open-weight Qwen) or "qwen" (Alibaba DashScope)
        'provider' => env('AI_PROVIDER', 'fake'),
    ],

    // Free local stand-in until DashScope access is granted. Ollama serves an
    // OpenAI-compatible API, so QwenProvider talks to it unchanged.
    'ollama' => [
        // Inside Docker, compose.yaml overrides this with http://host.docker.internal:11434/v1
        'base_url' => env('OLLAMA_BASE_URL', 'http://localhost:11434/v1'),
        'model' => env('OLLAMA_MODEL', 'qwen2.5:3b'),
        // Local models are slower than the cloud API, especially on the first (cold) call.
        'timeout' => (int) env('OLLAMA_TIMEOUT', 120),
    ],

    'qwen' => [
        'api_key' => env('DASHSCOPE_API_KEY'),
        // International (Singapore) region; China region: https://dashscope.aliyuncs.com/compatible-mode/v1
        'base_url' => env('QWEN_BASE_URL', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
        'model' => env('QWEN_MODEL', 'qwen-plus'),
        'timeout' => (int) env('QWEN_TIMEOUT', 30),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];

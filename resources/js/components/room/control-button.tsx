import type { ReactNode } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'active' | 'danger' | 'success';

const tones: Record<Tone, string> = {
    default:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
    // e.g. muted mic / camera off: draws attention that something is disabled
    active: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30',
    danger: 'bg-destructive text-white hover:bg-destructive/90',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
};

type ControlButtonProps = {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    tone?: Tone;
    disabled?: boolean;
    /** Show the label next to the icon from the `sm` breakpoint up. */
    showLabel?: boolean;
};

export function ControlButton({
    label,
    icon,
    onClick,
    tone = 'default',
    disabled,
    showLabel = false,
}: ControlButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    aria-label={label}
                    className={cn(
                        'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:min-w-12 [&_svg]:size-5',
                        showLabel && 'sm:px-5',
                        tones[tone],
                    )}
                >
                    {icon}
                    {showLabel && (
                        <span className="hidden sm:inline">{label}</span>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
}

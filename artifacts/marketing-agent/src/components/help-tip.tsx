import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  text: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  label?: string;
}

/**
 * Small contextual help icon that reveals a tooltip on hover/focus.
 * Use sparingly next to features whose purpose isn't obvious to a non-tech user.
 */
export function HelpTip({ text, className, side = "top", label = "Aide" }: HelpTipProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-[#5b54d6]/40 cursor-help",
            className,
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed bg-popover text-popover-foreground border border-border shadow-lg">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

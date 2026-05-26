import { toast } from "sonner";
import { humanizeError } from "./humanize-error";

/**
 * Show a friendly, French error toast for any backend / network / SDK error.
 * Falls back to a sensible message when the error shape is unknown.
 */
export function toastError(err: unknown, fallback = "Quelque chose n'a pas fonctionné"): void {
  const h = humanizeError(err);
  toast.error(h?.message ?? fallback, {
    description: h?.hint,
    duration: 6000,
  });
}

/**
 * Success toast with consistent duration and optional secondary description.
 */
export function toastSuccess(message: string, description?: string): void {
  toast.success(message, {
    description,
    duration: 3500,
  });
}

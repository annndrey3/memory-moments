import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", size = "default", ...props }) {
  const variants = {
    default: "btn-shine bg-primary text-white hover:bg-violet-600 shadow-sm hover:shadow-glow",
    outline: "border border-slate-200 bg-white hover:bg-slate-50 hover:border-violet-300 text-slate-700",
    ghost: "hover:bg-slate-100 text-slate-700",
    destructive: "bg-red-500 text-white hover:bg-red-600",
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-8 px-3 text-sm",
    lg: "h-11 px-6",
    icon: "h-9 w-9 p-0",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium",
        "transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
        "disabled:opacity-50 disabled:translate-y-0 disabled:hover:translate-y-0",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }) {
  return (
    <label className={cn("text-sm font-medium text-slate-700", className)} {...props} />
  );
}

export function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-violet-100 text-violet-700",
    success: "bg-emerald-100 text-emerald-700",
    muted: "bg-slate-100 text-slate-600",
    danger: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

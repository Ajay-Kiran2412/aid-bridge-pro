import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  icon: string;
  name: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const BadgeDisplay = ({ 
  icon, 
  name, 
  description, 
  size = "md",
  showLabel = true 
}: BadgeDisplayProps) => {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl"
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-accent shadow-lg transition-bounce hover:scale-110",
          size === "sm" && "w-8 h-8",
          size === "md" && "w-12 h-12",
          size === "lg" && "w-16 h-16"
        )}
        title={description}
      >
        <span className={sizeClasses[size]}>{icon}</span>
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{name}</span>
          {description && size !== "sm" && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};

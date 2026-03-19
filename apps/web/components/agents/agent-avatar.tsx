import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isImageAvatar(avatar: string | null | undefined): avatar is string {
  if (!avatar) {
    return false;
  }

  return /^(https?:\/\/|data:image\/|\/)/i.test(avatar.trim());
}

interface AgentAvatarProps {
  name: string;
  avatar: string | null | undefined;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export function AgentAvatar({
  name,
  avatar,
  className,
  imageClassName,
  textClassName,
}: AgentAvatarProps): React.JSX.Element {
  if (isImageAvatar(avatar)) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <img
          src={avatar}
          alt={`${name} avatar`}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <span className={cn(textClassName)}>{avatar ?? getInitials(name)}</span>
    </div>
  );
}

import Icon from "./Icon";
import { isIconName } from "./Icon";

/**
 * Renders a habit's icon: new habits store a lucide icon name (rendered as a
 * crisp line icon); legacy habits may still hold an emoji, which renders as-is.
 */
export default function HabitIcon({
  icon,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: {
  icon: string;
  className?: string;
  strokeWidth?: number;
}) {
  if (isIconName(icon)) {
    return <Icon name={icon} className={className} strokeWidth={strokeWidth} />;
  }
  return <span className={className} style={{ lineHeight: 1 }}>{icon}</span>;
}

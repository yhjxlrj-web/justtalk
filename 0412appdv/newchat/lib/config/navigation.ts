import type { Dictionary } from "@/lib/i18n/messages";
import type { NavigationItem } from "@/types/navigation";

export function getNavigationItems(dictionary: Dictionary): NavigationItem[] {
  return [
    {
      href: "/home?tab=friends",
      label: dictionary.friends,
      icon: "friends",
      match: "prefix"
    },
    {
      href: "/home?tab=chats",
      label: dictionary.chats,
      icon: "chat",
      match: "prefix"
    },
    {
      href: "/home?tab=settings",
      label: dictionary.settings,
      icon: "settings",
      match: "prefix"
    }
  ];
}

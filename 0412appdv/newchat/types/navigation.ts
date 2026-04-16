export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  match?: "exact" | "prefix";
};

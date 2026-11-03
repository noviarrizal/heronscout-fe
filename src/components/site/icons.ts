// Service icons, shared by the server-rendered sections and the client hero fan.
import type { Icon } from "@phosphor-icons/react";
import {
  BuildingsIcon,
  DropIcon,
  FanIcon,
  HammerIcon,
  HouseIcon,
  HouseLineIcon,
  LightningIcon,
  LockKeyIcon,
  PaintRollerIcon,
  PlantIcon,
  SprayBottleIcon,
  SquaresFourIcon,
  ThermometerSimpleIcon,
  TreeIcon,
  WallIcon,
  WrenchIcon,
} from "@phosphor-icons/react/ssr";

export const serviceIcon: Record<string, Icon> = {
  interior: PaintRollerIcon,
  exterior: HouseLineIcon,
  cabinets: SquaresFourIcon,
  wallpaper: WallIcon,
  repair: WrenchIcon,
  commercial: BuildingsIcon,
  deck: TreeIcon,
  roof: HouseIcon,
  spray: SprayBottleIcon,
  plumbing: DropIcon,
  hvac: FanIcon,
  heating: ThermometerSimpleIcon,
  electrical: LightningIcon,
  lawn: PlantIcon,
  lock: LockKeyIcon,
  // Neutral, so a plumber's or cleaner's "general" service doesn't get a paintbrush.
  general: HammerIcon,
};

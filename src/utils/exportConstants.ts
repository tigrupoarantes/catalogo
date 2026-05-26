
export interface ExportConfig {
  showBrand: boolean;
  showCategory: boolean;
  showName: boolean;
  showCode: boolean;
  showBox: boolean;
  showEan: boolean;
  sidebarColor?: string;
}

export const EXPORT_COLORS = {
  PAGE_BG: "#242525",
  PRIMARY_BLUE: "#242525",
  DARK_BLUE: "#001C3F",
  MAGENTA: "#E30613",
  WHITE: "#ffffff",
  LIGHT_GRAY: "#F9FAFB",
  TEXT_GRAY: "#9CA3AF",
};

export const EXPORT_DIM = {
  WIDTH: 210,
  HEIGHT: 297,
  SIDEBAR_WIDTH: 15,
  HEADER_HEIGHT: 35,
  FOOTER_HEIGHT: 12,
  MARGIN: 8,
  GAP: 2,
};

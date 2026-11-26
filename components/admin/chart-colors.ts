export const adminChartColors = {
  primary: "#F8769C",
  secondary: "#EC658D",
  tertiary: "#D9547D",
  fill: "#FFE8EF",
  soft: "#FFF1F5",
  labels: "#6F5964",
  text: "#30262B",
  grid: "#E8DDE1",
  surface: "#FFFFFF",
} as const;

export const adminChartTooltip = {
  backgroundColor: adminChartColors.surface,
  borderColor: adminChartColors.grid,
  textStyle: { color: adminChartColors.text },
} as const;

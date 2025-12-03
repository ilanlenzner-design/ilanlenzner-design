export interface AspectRatio {
  label: string;
  value: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { label: "Square (1:1)", value: "1:1" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Standard (4:3)", value: "4:3" },
  { label: "Classic Portrait (3:4)", value: "3:4" },
];

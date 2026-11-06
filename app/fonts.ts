import localFont from "next/font/local";
import { Onest } from "next/font/google";

export const cuteDino = localFont({
  src: "../font/Cute Dino.otf",
  variable: "--font-cute-dino",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const onest = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
  display: "swap",
});

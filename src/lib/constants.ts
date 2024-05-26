import { join } from "path";

export const rootDir = join(import.meta.dirname, "..", "..");
export const srcDir = join(rootDir, "src");

export function getDefaultSoundfont(source: "Touhou.sf2" | "SGMv2.sf2") {
    return join(rootDir, "assets", "soundfont", source);
}

export const RandomLoadingMessage = ["Computing...", "Thinking...", "Cooking some food", "Give me a moment", "Loading..."];

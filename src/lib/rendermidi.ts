import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import temp from "temp";

import { getDefaultSoundfont, srcDir } from "#unane/lib/constants";

const asyncExcec = promisify(execFile);

export default async function render(file: ArrayBuffer | Buffer, gain = 2, soundfont = getDefaultSoundfont("SGMv2.sf2")) {
    const pathInput = temp.path();
    const pathOutput =  temp.path() + ".wav";
    const pathConverted =  temp.path() + ".mp3";

    await writeFile(pathInput, Buffer.from(file))

    const fluidResult = await asyncExcec("fluidsynth", [
        "--fast-render", pathOutput,
        "--gain", `${gain}`,
        soundfont,
        pathInput,
    ]);
    unlink(pathInput);
    if (fluidResult.stderr) {
        throw new Error(fluidResult.stderr);
    }

    const ffmpegResult = await asyncExcec("ffmpeg", [
        "-i", pathOutput,
        "-vn",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", "192k",
        pathConverted
    ]);
    unlink(pathOutput);

    const buffer = await readFile(pathConverted);
    unlink(pathConverted);

    return buffer;
}
import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Chord, Note, Progression } from "tonal";
import { Canvas } from "canvas-constructor/napi-rs";

const ROMAN_NUMBER_NOTE = ["i", "ii", "iii", "iv", "v", "vi", "vii"];

type ChordResult = ReturnType<typeof Chord.get>;

@ApplyOptions<Command.Options>({
    name: "chord",
    description: "get notes from chord you type",
})
export class ChordCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(str => str
                .setName("chords")
                .setDescription("a list chord to convert separate by -")
                .setRequired(true)
            )
            .addStringOption(str => str
                .setName("roman_numeral")
                .setDescription("Specify if you use roman numeral for chord notation")
                .addChoices([{
                    name: "use major scale",
                    value: "major"
                }, {
                    name: "use minor scale",
                    value: "minor"
                }])
            )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const input = interaction.options.getString("chords", true);
        const romanNumeralMode = interaction.options.getString("roman_numeral");

        await interaction.deferReply();

        const chords = this.getProgressions(input, romanNumeralMode);
        if (chords.filter(x => !x.empty).length < 1) return interaction.editReply({ content: "nothing to show"});
        const image = this.drawChords(chords);
        interaction.editReply({ files: [{ attachment: image }]});
    }

    private getProgressions(input: string, romanNumeralMode: string | null): ChordResult[] {
        const geterChord: ChordResult[] = [];
        for (let chord of input.split("-")) {
            chord = chord.trim();
            if (romanNumeralMode === "major") {
                chord = Progression.fromRomanNumerals("C", [chord])[0];
            } else if (romanNumeralMode === "minor") {
                let num = "";
                for (let i = 3; i > 0; i--) {
                    num = chord.substring(0, i);
                    if (ROMAN_NUMBER_NOTE.includes(num.toLocaleLowerCase())) break;
                }
                chord = chord.replace(num, ROMAN_NUMBER_NOTE[(ROMAN_NUMBER_NOTE.indexOf(num.toLowerCase()) + 5)%ROMAN_NUMBER_NOTE.length]);
                chord = Progression.fromRomanNumerals("C", [chord])[0];
            }
            geterChord.push(Chord.get(chord));
        }

        return geterChord;
    }

    private drawChords(chords: ChordResult[]) {
        const midis: number[][] = [];
        let minMidis = Number.MAX_VALUE;
        let maxMidis = 0;
        for (const chord of chords) {
            const chordMidi: number[] = [];
            if (!chord.empty) {
                for (const intervals of chord.intervals) {
                    const transposed = Note.transpose(`${chord.tonic}4`, intervals);
                    const midi = Note.midi(transposed)!;
                    minMidis = Math.min(minMidis, midi);
                    maxMidis = Math.max(maxMidis, midi);
                    chordMidi.push(midi);
                }
            }
            midis.push(chordMidi);
        }
        const width = 150;
        const height = 10;
        const diff = maxMidis - minMidis;

        const canvas = new Canvas(
            midis.length * width,
            (diff + 7) * height
        ).setTextFont("30px Sans");

        let h = 0;
        for (let i = 0; i < midis.length; i++) {
            const chord = midis[i];
            for (const midi of chord) {
                const met = canvas.measureText(chords[i].symbol);
                canvas
                .setColor(`hsl(${h}, 100%, 50%)`)
                .printRectangle(
                    i * width, 
                    (maxMidis - midi) * height,
                    width,
                    height,
                ).setColor("#FFFFFF")
                .printText(
                    chords[i].symbol,
                    (i * width) + (width / 2) - (met.width / 2),
                    (diff + 5) * height
                );
            }
            if (chord.length) h += 30;
        }
        return canvas.canvas.toBuffer("image/png");
    }
}
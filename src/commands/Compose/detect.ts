import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Chord, Note } from "tonal";
import tone from "@tonejs/midi";
import { Canvas } from "canvas-constructor/napi-rs";

type ChordResult = ReturnType<typeof Chord.get>;
interface NoteData {
    midi: number,
    pos: number,
    length: number,
}
interface MidiChordData {
    datas: NoteData[],
    chord: ChordResult
}
interface ProgressionsMidiData {
    minMidi: number,
    maxMidi: number,
    duration: number,
    progressions: MidiChordData[],
}

@ApplyOptions<Command.Options>({
    name: "detect",
    description: "Detect chord from midi file"
})
export class DetectChordCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addAttachmentOption(input => input
                .setName("midi")
                .setDescription("midi file to detect")
                .setRequired(true)
            )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const midiFile = interaction.options.getAttachment("midi", true);
        await interaction.deferReply();
        const file = await fetch(midiFile.url).then(res => res.arrayBuffer());
        const progData = this.getChordsFromMidi(file);
        return interaction.editReply({
            files: progData.map(x => this.drawChord(x))
        });
    }

    private getChordsFromMidi(midiFile: ArrayBuffer, maxTick = 20, maxTrack = 2): ProgressionsMidiData[] {
        const midi = new tone.Midi(midiFile);
        const results: ProgressionsMidiData[] = [];

        let tracked = 0;

        for (const track of midi.tracks) {
            const chords: MidiChordData[] = [];
            let maxMidi = 0;
            let minMidi = Number.MAX_VALUE;
            let notesData: NoteData[] = [];
            let notes: number[] = [];
            let pointer = track.notes[0]?.ticks || 0;
            for (const note of track.notes) {
                maxMidi = Math.max(maxMidi, note.midi);
                minMidi = Math.min(minMidi, note.midi);
                notes.push(note.midi);
                notesData.push({
                    midi: note.midi,
                        pos: note.ticks / midi.header.ppq,
                        length: Math.min(
                            note.durationTicks / midi.header.ppq,
                            midi.header.ppq * maxTick,
                        ),
                });
                if (note.ticks !== pointer) {
                    const poopedNote = notes.pop();
                    const poopedData = notesData.pop()!;
                    const chord = this.midiToChords(notes);
                    if (!chord.empty) chords.push({
                        datas: notesData,
                        chord
                    });
                    notes = [poopedNote!];
                    notesData = [poopedData!];
                    pointer = note.ticks;
                    if (pointer >= (maxTick * midi.header.ppq)) break;
                }
            }
            const chord = this.midiToChords(notes);
            if (!chord.empty) chords.push({
                datas: notesData,
                chord
            });
            if (chords.length) {
                results.push({
                    progressions: chords,
                    minMidi,
                    maxMidi,
                    duration: Math.min(
                        midi.durationTicks / midi.header.ppq,
                        maxTick,
                    ),
                });
                tracked++;
                if (tracked >= maxTrack) break;
            }
        }

        return results;
    }

    private midiToChords(chords: number[]) {
        const chordStr = chords
            .sort((a, b) => a - b)
            .map(x => {
                const midi = Note.fromMidi(x);
                return Note.get(midi).pc
            });
        return Chord.get(Chord.detect(chordStr)[0] || "");
    }

    private drawChord(data: ProgressionsMidiData) {
        const width = 150;
        const height = 10;
        const diff = data.maxMidi - data.minMidi;

        const canvas = new Canvas(
            data.duration * width,
            (diff + 7) * height
        ).setTextFont("30px Sans");

        let h = 0;
        for (const chord of data.progressions) {
            for (let i = 0; i < chord.datas.length; i++) {
                const note = chord.datas[i];
                const chordName = chord.chord.symbol;
                const met = canvas.measureText(chordName);
                canvas
                .setColor(`hsl(${h}, 100%, 50%)`)
                .printRectangle(
                    note.pos * width, 
                    (data.maxMidi - note.midi) * height,
                    note.length * width,
                    height,
                ).setColor("#FFFFFF")
                .printText(
                    chordName,
                    (note.pos * width) + (width / 2) - (met.width / 2),
                    (diff + 5) * height
                );
            }
            h += 30;
        }
        return canvas.canvas.toBuffer("image/png");
    }
}
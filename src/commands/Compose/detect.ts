import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Chord, Note } from "tonal";
import tone from "@tonejs/midi";
import { Canvas } from "canvas-constructor/napi-rs";
import { AttachmentBuilder, EmbedBuilder, APIEmbedField, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { EmbedLimits } from "@sapphire/discord-utilities";

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
        if (progData.length < 1) return interaction.editReply({ content: "nothing to show" });
        
        const embed = new EmbedBuilder().setColor("LightGrey");

        const fields: APIEmbedField[] = [];
        const attachments: AttachmentBuilder[] = [];
        for (let i = 0; i < progData.length; i++) {
            const track = progData[i];
            const value = track.progressions
                .filter(x => !x.chord.empty)
                .map(({chord}) => chord.symbol);

            attachments.push(new AttachmentBuilder(this.drawChord(track)));
            if (value.length > 0) fields.push({
                name: `Track ${i+1}`,
                value: value.length > 20 ? [value.slice(0, 20), `...and ${value.length - 20}more`].join(" - ") : value.join(" - "),
                inline: false,
            });
        }
        if (fields.length > 0) embed.addFields(...fields);

        const linkButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(midiFile.url)
            .setLabel("MIDI FILE");

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(linkButton);

        return interaction.editReply({
            embeds: [embed],
            files: attachments,
            components: [row]
        })
    }

    private getChordsFromMidi(midiFile: ArrayBuffer, maxTick = Number.MAX_VALUE, maxTrack = 5): ProgressionsMidiData[] {
        const midi = new tone.Midi(midiFile);
        const results: ProgressionsMidiData[] = [];

        let tracked = 0;

        for (const track of midi.tracks) {
            const chords: MidiChordData[] = [];
            const gap = track.notes[0]?.ticks;
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
                        pos: (note.ticks - gap) / midi.header.ppq,
                        length: Math.min(
                            (note.durationTicks - gap) / midi.header.ppq,
                            midi.header.ppq * maxTick,
                        ),
                });
                if (note.ticks !== pointer) {
                    const poopedNote = notes.pop();
                    const poopedData = notesData.pop()!;
                    const chord = this.midiToChords(notes);
                    if (chord.empty) {
                        chord.symbol = "?";
                    }
                    chords.push({
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
                        (midi.durationTicks - gap) / midi.header.ppq,
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
        const diff = data.maxMidi - data.minMidi;

        const width =  ((data.duration%10) + 1) * 12;
        const height = ((diff%10) + 1) * 2;

        const canvas = new Canvas(
            data.duration * width,
            (diff + 7) * height
        ).setTextFont(`${width > height ? height*3.5 : width*1.5}px Sans`);

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
                    (note.pos * width)
                    + (note.length * width / 2)
                    - (met.width / 2),
                    (diff + 5) * height
                );
            }
            h += 30;
        }
        return canvas.canvas.toBuffer("image/png");
    }
}
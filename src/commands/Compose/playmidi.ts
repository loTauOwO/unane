import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { AttachmentBuilder } from "discord.js";
import { render } from "fluidnode";
import path from "node:path";


@ApplyOptions<Command.Options>({
    name: "playmidi",
    description: "convert midi file to mp3"
})
export class PlayMidiCommand extends Command {
    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand(builder => builder
            .setName(this.name)
            .setDescription(this.description)
            .addAttachmentOption(attachment => attachment
                .setName("midi")
                .setDescription("midi file to be played")
                .setRequired(true)
            )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const midiAttachment = interaction.options.getAttachment("midi", true);
        await interaction.deferReply();
        try {
            const file = await fetch(midiAttachment.url).then(x => x.arrayBuffer());
            const buffer = await this.renderMidi(Buffer.from(file));
            return interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: `${midiAttachment.name.split(".")[0]}.wav`})] })
        } catch (e){
            interaction.editReply(`${e}`);
        }
    }

    private async renderMidi(file: Buffer) {
        const buffer = await render(file, {
            gain: 2,
            soundfont: path.join(process.cwd(), "./assets/soundfont/GeneralUser.sf2")
        });
        return buffer;
    }
} 
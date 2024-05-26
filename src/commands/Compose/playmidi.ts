import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { AttachmentBuilder } from "discord.js";
import renderMidi from "#unane/lib/rendermidi";
import { getDefaultSoundfont } from "#unane/lib/constants";


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
            .addStringOption(str => str
                .setName("soundfont")
                .setDescription("Soundfont to be used")
                .addChoices([
                    { name: "Touhou", value: "touhou" },
                    { name: "SGMv2", value: "sgmv2"},
                ])
            )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const midiAttachment = interaction.options.getAttachment("midi", true);
        const soundfont = interaction.options.getString("soundfont");
        await interaction.deferReply();

        const name = midiAttachment.name.split(".");
        name.pop();
        try {
            const file = await fetch(midiAttachment.url).then(x => x.arrayBuffer());
            const buffer = await renderMidi(file, 1, getDefaultSoundfont(soundfont === "touhou" ? "Touhou.sf2" : "SGMv2.sf2"));
            return interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: `${name.join(".")}.mp3`})] })
        } catch (e){
            interaction.editReply(`${e}`);
        }
    }
}
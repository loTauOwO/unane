import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";

@ApplyOptions<Command.Options>({
	description: "A ping pong command to see if bots alive or not",

})
export class UserCommand extends Command {
	// Register slash and context menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description
		});
	}

	// slash command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const msg = await interaction.reply({ content: ":ping_pong: Ping...", fetchReply: true });

		const content = `:ping_pong: Pong! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${
			msg.createdTimestamp - interaction.createdTimestamp
		}ms.`;

		return interaction.editReply({ content });
	}
}

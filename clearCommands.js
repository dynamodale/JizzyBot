// Run this ONCE to see all registered commands, then delete this file
// Usage: node clearCommands.js
 
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();
 
const rest = new REST().setToken(process.env.TOKEN || process.env.DISCORD_TOKEN);
 
(async () => {
    try {
        console.log('Fetching all registered guild commands...');
        const commands = await rest.get(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
        );
 
        console.log(`\n📋 Currently registered commands (${commands.length} total):`);
        commands.forEach(cmd => console.log(`  - /${cmd.name}: ${cmd.description}`));
 
        console.log('\nClearing all guild slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: [] }
        );
        console.log('✅ All guild commands cleared!');
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();

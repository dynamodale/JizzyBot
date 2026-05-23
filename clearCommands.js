// Run this ONCE to clear ghost slash commands, then delete this file
// Usage: node scripts/clearCommands.js
 
import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();
 
const rest = new REST().setToken(process.env.TOKEN || process.env.DISCORD_TOKEN);
 
(async () => {
    try {
        console.log('Clearing all guild slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: [] }
        );
        console.log('✅ All guild commands cleared! Restart the bot now to re-register fresh.');
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();

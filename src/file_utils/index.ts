
import * as fs from 'fs';

export function getJustfileCommands(justfilePath: string): string[] {
    // Read the Justfile content
    const fileContent = fs.readFileSync(justfilePath, 'utf-8');

    // Use a regular expression to match lines that define commands
    const commandRegex = /^[a-zA-Z0-9_-]+:/gm;

    // Find all matches
    const matches = fileContent.match(commandRegex);

    if (matches) {
        // Remove the trailing colon (:) from each command and return
        return matches.map(command => command.replace(':', ''));
    }

    // Return an empty array if no commands are found
    return [];
}

export function parseJustfile(justfileContent: string): string[] {
    try {

        // Split the content into lines
        const lines = justfileContent.split('\n');

        // Initialize an empty array to store the commands
        const commands: string[] = [];

        // Regular expression to match a command (e.g., "build:" or "test:")
        const commandRegex = /^[a-zA-Z0-9_-]+:/;

        // Iterate over each line and extract the command if it matches the regex
        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if the line matches the pattern for a command
            const match = trimmedLine.match(commandRegex);
            if (match) {
                // Remove the colon (:) and add the command to the list
                const command = match[0].slice(0, -1);
                commands.push(command);
            }
        }

        return commands;
    } catch (error) {
        console.error(`Error reading or parsing the justfile: ${error}`);
        return [];
    }
}
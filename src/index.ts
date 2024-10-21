#!/usr/bin/env node

import chalk from 'chalk';
import { execSync } from 'child_process';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { generateCircleCIConfig } from './ci';
import { parseDependencyGraph } from './dag';
import { getJustfileCommands } from './file_utils';

const program = new Command();

// Define the application version and description
program
    .version('1.0.0')
    .description('A simple CLI tool in TypeScript');

program
    .command('show')
    .description('Display project dependencies')
    .option('-f, --folder <folder>', 'Root build folder')
    .action((options: { folder?: string }) => {
        const rootDir = options.folder
            ? path.isAbsolute(options.folder) ? options.folder : path.join(process.cwd(), options.folder)
            : process.cwd();

        console.log(chalk.green("Reading project ... root = " + rootDir + "\n"));

        const dag = parseDependencyGraph(rootDir);

        console.log(chalk.blue("Parsed project: \n"));
        dag.displayDAG();
    });

program
    .command('run')
    .description('Run cmd for project')
    .argument("cmd")
    .option('-f, --folder <folder>', 'Root build folder')
    .action((cmd: string, options: { folder?: string }) => {
        console.log(chalk.blue("Running command " + cmd));

        const rootDir = options.folder
            ? path.isAbsolute(options.folder) ? options.folder : path.join(process.cwd(), options.folder)
            : process.cwd(); console.log(chalk.green("Deploying project ... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir);

        console.log(chalk.blue("Parsed project: \n"));
        dag.displayDAG();
        const buildOrder = dag.breadthFirstTraversalByLevels();

        const availableCommands = buildOrder
            .flatMap(folders => folders.flatMap(folder => getJustfileCommands(path.join(rootDir, folder, "/justfile"))))
            .filter((value, index, array) => array.indexOf(value) === index)

        if (availableCommands.indexOf(cmd) === -1) {
            console.log(chalk.red("Command not recognised, " + cmd));
            console.log(chalk.white("Choose from " + availableCommands));
        }

        buildOrder.forEach((level) => {
            level.forEach((folder) => {
                const commandsForFolder = getJustfileCommands(path.join(rootDir, folder, "/justfile"));
                if (commandsForFolder.indexOf(cmd) === -1) {
                    console.log(`No ${cmd} command foudn for ${folder}...`);
                    return;
                }

                console.log("-----------------------------------------")
                console.log(`${cmd} ${folder}...`);
                console.log("-----------------------------------------")

                execSync(`just ${cmd}`, { cwd: path.join(rootDir, folder), stdio: 'inherit' });
                console.log("-----------------------------------------")
                console.log(`Finished ${cmd}`, folder)
                console.log("-----------------------------------------")
            })
        });


    });

program
    .command('ci')
    .description('Generate ci config for whole project')
    .addArgument(program.createArgument('type', 'Ci to output').choices(['circleci']))
    .option('-f, --folder <folder>', 'Root build folder')
    .option('-o, --output <file>', 'Output file path')
    .action((_type: string, options: { folder?: string, output?: string }) => {
        const rootDir = options.folder
            ? path.isAbsolute(options.folder) ? options.folder : path.join(process.cwd(), options.folder)
            : process.cwd();

        console.log(chalk.green("Generating ci config for... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir);

        console.log(chalk.blue("Parsed project: \n"));
        dag.displayDAG();

        const circleCiStr = generateCircleCIConfig({
            dag: dag,
            buildOrderLevels: dag.breadthFirstTraversalByLevels(),
        }, (options.folder && path.isAbsolute(options.folder)) ? rootDir : undefined);

        const outFile = options.output || path.join('out/cirlci-config.yml')

        fs.writeFileSync(outFile, circleCiStr);
        console.log(chalk.green("Generated file at " + outFile));
    });

program
    .command('help')
    .description('Display help information')
    .action(() => {
        console.log(chalk.blue('Use this tool to greet someone with optional colored text.'));
        program.outputHelp();
    });

// Parse the command line arguments
program.parse(process.argv);

// If no arguments are provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

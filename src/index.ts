#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { runProjectWithDAG } from './build';
import { generateCircleCIConfig } from './ci';
import { parseDependencyGraph } from './dag';

const program = new Command();

// Define the application version and description
program
    .version('1.0.0')
    .description('A simple CLI tool in TypeScript');

program
    .command('build')
    .description('Build whole project')
    .option('-f, --folder <folder>', 'Root build folder')
    .action((options: { folder?: string }) => {
        const rootDir = options.folder ? path.join(process.cwd(), options.folder) : process.cwd();
        console.log(chalk.green("Building project ... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir, "build");

        const buildOrder = dag.breadthFirstTraversalByLevels();

        runProjectWithDAG("build", buildOrder, rootDir);
    });

program
    .command('deploy')
    .description('Deploy whole project')
    .option('-f, --folder <folder>', 'Root build folder')
    .action((options: { folder?: string }) => {
        const rootDir = options.folder ? path.join(process.cwd(), options.folder) : process.cwd();
        console.log(chalk.green("Deploying project ... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir, "deploy");
        const buildOrder = dag.breadthFirstTraversalByLevels();

        runProjectWithDAG("deploy", buildOrder, rootDir);
    });
program
    .command('test')
    .description('Test whole project')
    .option('-f, --folder <folder>', 'Root build folder')
    .action((options: { folder?: string }) => {
        const rootDir = options.folder ? path.join(process.cwd(), options.folder) : process.cwd();
        console.log(chalk.green("Testing project ... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir, "test");
        const buildOrder = dag.breadthFirstTraversalByLevels();

        runProjectWithDAG("test", buildOrder, rootDir);
    });

program
    .command('package')
    .description('Package whole project')
    .option('-f, --folder <folder>', 'Root build folder')
    .action((options: { folder?: string }) => {
        const rootDir = options.folder ? path.join(process.cwd(), options.folder) : process.cwd();
        console.log(chalk.green("Packaging project ... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir, "package");
        const buildOrder = dag.breadthFirstTraversalByLevels();

        runProjectWithDAG("test", buildOrder, rootDir);
    });

program
    .command('ci')
    .description('Generate ci config for whole project')
    .addArgument(program.createArgument('type', 'Ci to output').choices(['circleci']))
    .option('-f, --folder <folder>', 'Root build folder')
    .option('-o, --output <folder>', 'Output folder')
    .action((type: string, options: { folder?: string }) => {
        const rootDir = options.folder ? path.join(process.cwd(), options.folder) : process.cwd();
        console.log(chalk.green("Generating ci config for... root = " + rootDir));

        const dag = parseDependencyGraph(rootDir, "build");
        const buildOrder = dag.breadthFirstTraversalByLevels();

        const circleCiStr = generateCircleCIConfig(dag, buildOrder, rootDir);
        fs.writeFileSync(path.join('out/cirlci-config.yml'), circleCiStr);
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

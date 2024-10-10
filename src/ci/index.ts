import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { DAG } from "../dag";
import { z } from "zod";
import chalk from 'chalk';


type DagAndBuildOrder = {
    dag: DAG,
    buildOrderLevels: string[][]
}

export const generateCircleCIConfig = (dagAndBuildOrder: DagAndBuildOrder, rootDir: string) => {
    let circleCiOutput: any = {
        version: 2,
        jobs: [],
        workflows: {}
    };
    const folderToContents = new Map<string, any>();
    const buildOrderLevels = dagAndBuildOrder.buildOrderLevels;
    const folderToCommands = new Map<string, string[]>();

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const filePath = path.join(rootDir, folder, 'circleci-build.yml');
            console.log(chalk.blue("Reading " + filePath));

            const fileContents = fs.readFileSync(filePath, 'utf8');
            const circleCiObj = yaml.load(fileContents) as any;

            folderToContents.set(folder, circleCiObj);
            circleCiOutput = { ...circleCiOutput, ...circleCiObj['circle-ci-props'] };

            Object.entries(circleCiObj.jobs).forEach(([key, cmd]: any[]) => {

                circleCiOutput.jobs.push({ [key]: cmd });

                if (!folderToCommands.has(folder)) {
                    folderToCommands.set(folder, []);
                }
                folderToCommands.get(folder)!.push(key);

            });
        });

    });

    const jobsToWorkflowName = new Map<string, string>();


    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const circleCiObj = folderToContents.get(folder)!;

            Object.entries(circleCiObj.workflows).forEach(([workflowName, workflowCommand]: any[]) => {
                workflowCommand.jobs.forEach((job: any) => {
                    const keys = Object.keys(job);
                    keys.forEach((key) => {
                        jobsToWorkflowName.set(key, workflowName);
                    })
                })
            });
        })
    });



    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const circleCiObj = folderToContents.get(folder)!;

            Object.entries(circleCiObj.workflows).forEach(([workflowName, workflowCommand]: any[]) => {
                const jobs = workflowCommand.jobs;

                jobs.forEach((job: any) => {

                    const keys = Object.keys(job);
                    if (keys.length > 1) {
                        console.error(chalk.red("Too many keys in job " + keys))
                        throw new Error("Too many keys in job " + keys);
                    }

                    if (!circleCiOutput.workflows[workflowName]) {
                        circleCiOutput.workflows[workflowName] = {
                            jobs: []
                        }
                    }

                    const requriedJobs = (dagAndBuildOrder.dag.dependencies.get(folder) || []).flatMap((dep) => {
                        return folderToCommands.get(dep) || [];
                    }).filter((job) => jobsToWorkflowName.get(job) === workflowName)

                    circleCiOutput.workflows[workflowName].jobs.push({
                        [keys[0]]: {
                            ...job[keys[0]],
                            requires: [
                                ...(job[keys[0]].requires || []),
                                ...requriedJobs]
                        }
                    });
                })

            });

        })
    });

    return yaml.dump(circleCiOutput);
};


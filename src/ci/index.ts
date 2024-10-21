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

const mergeOtherProps = (folderToContents: Map<string, any>) => {
    const mergedProps: any = {};
    const parameters: any = [];
    const orbs: any = [];
    const executors: any = [];
    const commands: any = [];

    folderToContents.forEach((value, folder) => {

        const otherProps = Object.entries(value).filter(([key]) => key !== 'jobs' && key !== 'workflows').reduce((prev, curr) => {
            return { ...prev, [curr[0]]: curr[1] };
        }, {});

        Object.entries(otherProps).forEach(([key, value]: any[]) => {
            if (key === "parameters") {
                parameters.push(value);
            }
            if (key === "orbs") {
                orbs.push(value);
            }
            if (key === "executors") {
                executors.push(value);
            }
            if (key === "commands") {
                commands.push(value);
            }
            if (!mergedProps[key]) {
                mergedProps[key] = value;
            } else {
                if (typeof value === 'string' || typeof value === 'number') {
                    mergedProps[key] = value;
                } else {
                    mergedProps[key] = { ...mergedProps[key], ...value };
                }

            }

        })
    });


    for (const param of parameters) {
        mergedProps.parameters = { ...mergedProps.parameters, ...param };
    }

    for (const orb of orbs) {
        mergedProps.orbs = { ...mergedProps.orbs, ...orb };
    }
    for (const executor of executors) {
        mergedProps.executors = { ...mergedProps.executors, ...executor };
    }

    for (const command of commands) {
        mergedProps.commands = { ...mergedProps.commands, ...command };
    }

    return mergedProps;
}

export const generateCircleCIConfig = (dagAndBuildOrder: DagAndBuildOrder, rootDir?: string) => {
    let circleCiOutput: any = {
        version: 2,
        jobs: {},
        workflows: {}
    };
    const folderToContents = new Map<string, any>();
    const buildOrderLevels = dagAndBuildOrder.buildOrderLevels;
    const folderToCommands = new Map<string, string[]>();

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const filePath = rootDir ? path.join(rootDir, folder, 'circleci-build.yml') : path.join(folder, 'circleci-build.yml');
            console.log(chalk.blue("Reading " + filePath));

            const fileContents = fs.readFileSync(filePath, 'utf8');
            const circleCiObj = yaml.load(fileContents) as any;

            folderToContents.set(folder, circleCiObj);

            Object.entries(circleCiObj.jobs).forEach(([key, cmd]: any[]) => {
                circleCiOutput.jobs[key] = cmd;

                if (!folderToCommands.has(folder)) {
                    folderToCommands.set(folder, []);
                }
                folderToCommands.get(folder)!.push(key);

            });
        });

    });
    circleCiOutput = { ...circleCiOutput, ...mergeOtherProps(folderToContents) };

    const folderJobNames = new Map<string, string[]>();
    const jobsToWorkflowNames = new Map<string, string[]>();
    const workflowNameToCondition = new Map<string, any[]>();


    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const circleCiObj = folderToContents.get(folder)!;

            Object.entries(circleCiObj.workflows).forEach(([workflowName, workflowCommand]: any[]) => {
                const whens = workflowCommand.when
                if (whens) {
                    workflowNameToCondition.has(workflowName) ? workflowNameToCondition.get(workflowName)!.push(whens) : workflowNameToCondition.set(workflowName, [whens]);
                }

                workflowCommand.jobs.forEach((job: any) => {
                    const keys = Object.keys(job);
                    keys.forEach((key) => {
                        jobsToWorkflowNames.has(key) ? jobsToWorkflowNames.get(key)!.push(workflowName) : jobsToWorkflowNames.set(key, [workflowName]);
                        folderJobNames.has(folder) ? folderJobNames.get(folder)!.push(key) : folderJobNames.set(folder, [key]);
                    })
                })
            });
        })
    });

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const circleCiObj = folderToContents.get(folder)!;

            Object.entries(circleCiObj.workflows).forEach(([workflowName, workflowCommand]: any[]) => {
                const whens = workflowNameToCondition.get(workflowName);


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
                        return Array.from(new Set(folderJobNames.get(dep) || []));
                    }).filter((job) => jobsToWorkflowNames.get(job)?.indexOf(workflowName) !== -1);

                    circleCiOutput.workflows[workflowName].jobs.push({
                        [keys[0]]: {
                            ...job[keys[0]],
                            when: undefined,
                            requires: [
                                ...(job[keys[0]].requires || []),
                                ...requriedJobs]
                        }
                    });
                })
                if (whens) {
                    const normalWhens = whens.filter(when => typeof when === 'string').filter((value, index, array) =>
                        array.indexOf(value) === index);

                    const ands = whens.filter(when => typeof when === 'object').filter((value, index, array) =>
                        array.map(arrVal => JSON.stringify(arrVal)).indexOf(JSON.stringify(value)) === index
                    ).filter(value => !!value?.and).flatMap(when => when.and);

                    ands.push(...normalWhens);

                    if (ands) {
                        circleCiOutput.workflows[workflowName].when = {
                            and: ands?.length > 0 ? ands : undefined
                        }
                    }


                }
            });

        })
    });
    return yaml.dump(circleCiOutput, { lineWidth: 99999999999 });
};


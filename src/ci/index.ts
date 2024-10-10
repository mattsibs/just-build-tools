import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { DAG } from "../dag";
import { z } from "zod";
import chalk from 'chalk';

const circlCiSchema = z.object({
    jobs: z.array(z.any()),
    "circle-ci-props": z.object({}).optional(),
    workflow: z.record(z.string(), z.object({
        "just-depends-on-type": z.enum(["build", "test", "package", "upload", "deploy"]),
        jobs: z.array(z.record(z.string(), z.any())),
    })),
})
type dependsOnType = "build" | "test" | "package" | "upload" | "deploy"

type DagAndBuildOrder = {
    dag: DAG,
    buildOrderLevels: string[][]
}

export type JustBuildToolsDags = {
    build: DagAndBuildOrder
    test: DagAndBuildOrder
    package: DagAndBuildOrder
    upload: DagAndBuildOrder
    deploy: DagAndBuildOrder
}

type CirclBuildContents = z.infer<typeof circlCiSchema>;
export const generateCircleCIConfig = (dags: JustBuildToolsDags, rootDir: string) => {
    let circleCiOutput: any = {
        version: 2,
        jobs: [],
        workflows: {}
    };
    const folderToContents = new Map<string, CirclBuildContents>();
    Object.entries(dags).forEach(([dependencyType, dagAndBuildOrder]) => {
        const dag = dagAndBuildOrder.dag;
        const buildOrderLevels = dagAndBuildOrder.buildOrderLevels;
        const folderToCommands = new Map<string, string[]>();

        buildOrderLevels.forEach((level) => {
            level.forEach((folder) => {
                const filePath = path.join(rootDir, folder, 'circleci-build.yml');
                console.log(chalk.blue("Reading " + filePath));

                const fileContents = fs.readFileSync(filePath, 'utf8');
                const buildYml: { name: string, build: any, "workflow": any } = yaml.load(fileContents) as any;
                const circleCiObj = validateYml(filePath, buildYml);

                folderToContents.set(folder, circleCiObj);
                circleCiOutput = { ...circleCiOutput, ...circleCiObj['circle-ci-props'] };

                circleCiObj.jobs.forEach((buildCmd: any) => {
                    const keys = Object.keys(buildCmd);
                    if (keys.length > 1) {
                        console.error(chalk.red("Too many keys in build command " + keys))
                        throw new Error("Too many keys in build command " + keys);
                    }

                    const key = keys[0];
                    const cmd = buildCmd[key];
                    const dependsOnType = cmd["just-depends-on-type"];
                    delete cmd["just-depends-on-type"];

                    if (dependsOnType !== dependencyType) {
                        return;
                    }

                    circleCiOutput.jobs.push({ [key]: cmd });

                    if (!folderToCommands.has(folder)) {
                        folderToCommands.set(folder, []);
                    }
                    folderToCommands.get(folder)!.push(key);

                });
            });

        });


        buildOrderLevels.forEach((level) => {
            level.forEach((folder) => {
                const circleCiObj = folderToContents.get(folder)!;

                Object.entries(circleCiObj.workflow).forEach(([name, workflowCommand]) => {
                    const jobs = workflowCommand.jobs;
                    const dependsOnType = workflowCommand["just-depends-on-type"];

                    if (dependsOnType !== dependencyType) {
                        return;
                    }
                    jobs.forEach((job: any) => {

                        const keys = Object.keys(job);
                        if (keys.length > 1) {
                            console.error(chalk.red("Too many keys in job " + keys))
                            throw new Error("Too many keys in job " + keys);
                        }

                        if (!circleCiOutput.workflows[name]) {
                            circleCiOutput.workflows[name] = {
                                jobs: []
                            }
                        }

                        const requriedJobs = (dag.dependencies.get(folder) || []).flatMap((dep) => {
                            return folderToCommands.get(dep) || [];
                        })


                        circleCiOutput.workflows[name].jobs.push({
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
    });



    return yaml.dump(circleCiOutput);
};
function validateYml(folder: string, buildYml: { name: string; build: any; workflow: any; }) {
    try {
        return circlCiSchema.parse(buildYml);
    } catch (e: any) {
        console.log(chalk.red("Could not parse " + folder));
        console.log(e.message);

        throw new Error("Could not parse " + folder);
    }
}


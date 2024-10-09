import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { DAG } from "../dag";
import { z } from "zod";
import chalk from 'chalk';

const circlCiSchema = z.object({
    build: z.array(z.any()),
    "circle-ci-props": z.object({}).optional(),
    workflow: z.record(z.string(), z.object({
        "just-depends-on-type": z.enum(["build", "test", "package", "upload", "deploy"]),
        jobs: z.array(z.record(z.string(), z.any())),
    })),
})
type dependsOnType = "build" | "test" | "package" | "upload" | "deploy"
type CirclBuildContents = z.infer<typeof circlCiSchema>;
export const generateCircleCIConfig = (dag: DAG, buildOrderLevels: string[][], rootDir: string) => {
    const jobs: Record<string, any> = {};
    let circleCiOutput: any = {
        version: 2,
        jobs: [],
        workflows: {}
    };

    const folderToContents = new Map<string, CirclBuildContents>();
    const folderToBuildCommands = new Map<string, string[]>();
    const folderToCommands = new Map<string, Map<dependsOnType, string[]>>();

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const filePath = path.join(rootDir, folder, 'circleci-build.yml');

            const fileContents = fs.readFileSync(filePath, 'utf8');
            const buildYml: { name: string, build: any, "workflow": any } = yaml.load(fileContents) as any;

            const circleCiObj = validateYml(filePath, buildYml);

            folderToContents.set(folder, circleCiObj);
            circleCiOutput = { ...circleCiOutput, ...circleCiObj['circle-ci-props'] }

            circleCiObj.build.forEach((buildCmd: any) => {
                console.log("buildCmd", buildCmd)
                const keys = Object.keys(buildCmd);
                if (keys.length > 1) {
                    console.error(chalk.red("Too many keys in build command " + keys))
                    throw new Error("Too many keys in build command " + keys);
                }

                const key = keys[0];
                const cmd = buildCmd[key];
                circleCiOutput.jobs.push({ [key]: cmd });
                folderToBuildCommands.set(folder, [...folderToBuildCommands.get(folder) || [], key]);

            });
        });

    });

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const circleCiObj = folderToContents.get(folder)!;

            Object.entries(circleCiObj.workflow).forEach(([name, workflowCommand]) => {

                console.log("name", name)
                console.log("cmd", workflowCommand)
                const jobs = workflowCommand.jobs;


                const cmd = workflowCommand;

                console.log("name", name)
                console.log("cmd", cmd)

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
                    circleCiOutput.workflows[name].jobs.push({
                        [keys[0]]: {
                            ...job[keys[0]],
                            requires: [
                                ...(job[keys[0]].requires || []),
                                ...(dag.dependencies.get(folder) || []).flatMap((dep) => {
                                    return folderToBuildCommands.get(dep) || [];
                                })]
                        }
                    });
                })

            });

        })
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


import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { DAG } from "../dag";

export const generateCircleCIConfig = (dag: DAG, buildOrderLevels: string[][], rootDir: string) => {
    const jobs: Record<string, any> = {};
    const circleCiObj: any = {
        version: 2,
        jobs: [],
        workflows: {
            build_and_test: {
                jobs: [] as any[],
            },
        },
    };

    buildOrderLevels.forEach((level) => {
        level.forEach((folder) => {
            const filePath = path.join(rootDir, folder, 'circleci-build.yml');

            const fileContents = fs.readFileSync(filePath, 'utf8');
            const buildYml: { name: string, build: any, "workflow": any } = yaml.load(fileContents) as any;

            circleCiObj.jobs.push({ [buildYml.name]: buildYml.build });
            circleCiObj.workflows.build_and_test.jobs.push({
                [folder]: {
                    ...buildYml["workflow"],
                    requires: dag.dependencies.get(folder)
                }
            });
        })
    });
    return yaml.dump(circleCiObj);
};

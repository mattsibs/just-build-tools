import { execSync } from "child_process";
import path from "path";

export const runProjectWithDAG = (cmd: string, buildOrder: string[][], rootDir: string) => {

    console.log("Dependency order", buildOrder)
    buildOrder.forEach((level) => {
        level.forEach((folder) => {
            console.log("-----------------------------------------")
            console.log(`${cmd} ${folder}...`);
            console.log("-----------------------------------------")

            execSync(`just ${cmd}`, { cwd: path.join(rootDir, folder), stdio: 'inherit' });
            console.log("-----------------------------------------")
            console.log(`Finished ${cmd}`, folder)
            console.log("-----------------------------------------")
        })

    });
};
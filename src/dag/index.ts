import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Type definitions for the graph

export interface JustDependsOn {
    depends_on: string[];
}

// Graph class to represent a DAG
export class DAG {
    adjacencyList: Map<string, string[]> = new Map();
    private inDegree: Map<string, number> = new Map();
    dependencies: Map<string, string[]> = new Map(); // To store each folder's dependencies

    // Add an edge between two nodes
    addEdge(from: string, to: string) {
        if (!this.adjacencyList.has(from)) {
            this.adjacencyList.set(from, []);
            this.inDegree.set(from, 0);
        }
        if (!this.adjacencyList.has(to)) {
            this.adjacencyList.set(to, []);
            this.inDegree.set(to, 0);
        }

        this.adjacencyList.get(from)?.push(to);
        this.inDegree.set(to, (this.inDegree.get(to) || 0) + 1);

        if (!this.dependencies.has(to)) {
            this.dependencies.set(to, []);
        }
        this.dependencies.get(to)?.push(from);
    }
    addNode(node: string) {
        this.adjacencyList.set(node, []);
        this.inDegree.set(node, 0);
    }

    breadthFirstTraversalByLevels(): string[][] {
        const buildLevels: string[][] = [];
        let queue: string[] = [];
        const inDegreeCopy: any = new Map(JSON.parse(JSON.stringify(Array.from(this.inDegree))))
        const adjacencyListCopy: any = new Map(JSON.parse(JSON.stringify(Array.from(this.adjacencyList))))

        // Initialize queue with nodes that have no dependencies (in-degree = 0)
        for (const [node, degree] of inDegreeCopy.entries()) {
            if (degree === 0) {
                queue.push(node);
            }
        }

        // Traverse the graph level by level
        while (queue.length > 0) {
            const currentLevel: string[] = [];
            const nextQueue: string[] = [];

            // Process all nodes in the current level
            for (const current of queue) {
                currentLevel.push(current);

                // Process all adjacent nodes
                const neighbors = adjacencyListCopy.get(current) || [];
                for (const neighbor of neighbors) {
                    const newInDegree = (inDegreeCopy.get(neighbor) || 0) - 1;
                    inDegreeCopy.set(neighbor, newInDegree);

                    // If the neighbor has no remaining dependencies, add it to the next level
                    if (newInDegree === 0) {
                        nextQueue.push(neighbor);
                    }
                }
            }

            // Add the current level to the buildLevels array
            buildLevels.push(currentLevel);
            // Move to the next level
            queue = nextQueue;
        }
        return buildLevels;
    }

    // Breadth-First Search to traverse the graph
    breadthFirstTraversal(): string[] {
        const buildOrder: string[] = [];
        const queue: string[] = [];
        const inDegreeCopy: any = new Map(JSON.parse(JSON.stringify(Array.from(this.inDegree))))
        const adjacencyListCopy: any = new Map(JSON.parse(JSON.stringify(Array.from(this.adjacencyList))))
        // Initialize queue with nodes that have no dependencies (in-degree = 0)
        for (const [node, degree] of inDegreeCopy) {
            if (degree === 0) {
                queue.push(node);
            }
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            buildOrder.push(current);

            // Process all adjacent nodes
            const neighbors = adjacencyListCopy || [];
            for (const neighbor of neighbors) {
                const newInDegree = (inDegreeCopy.get(neighbor) || 0) - 1;
                inDegreeCopy.set(neighbor, newInDegree);

                // If the neighbor has no remaining dependencies, add it to the queue
                if (newInDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        return buildOrder;
    }
}

// Function to parse the just-depends-on.yml file for a subfolder
const parseDependencies = (dir: string): JustDependsOn => {
    const filePath = path.join(dir, 'just-depends-on.yml');
    if (fs.existsSync(filePath)) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return yaml.load(fileContents) as JustDependsOn;
    }

    return {
        depends_on: [],
    };
};


// Function to build the DAG from the subfolders and their dependencies
const buildDependencyGraph = (subfolders: string[], rootDir: string): DAG => {
    const dag = new DAG();
    subfolders.forEach((subfolder) => {
        dag.addNode(subfolder);
    })
    subfolders.forEach((subfolder) => {
        const subfolderPath = path.join(rootDir, subfolder);
        const dependsOn = parseDependencies(subfolderPath);

        dependsOn.depends_on.forEach((dep) => {
            dag.addEdge(dep, subfolder);
        });

    });


    return dag;
};
const scanForJustDependsOnFiles = (dir: string): string[] => {
    let justFiles: string[] = [];

    const items = fs.readdirSync(dir);

    items.forEach((item) => {
        const itemPath = path.join(dir, item);
        if (itemPath.indexOf("node_modules") !== -1) {
            return;
        }
        const stats = fs.lstatSync(itemPath);

        if (stats.isDirectory()) {
            // Recursively search in subdirectories
            justFiles = justFiles.concat(scanForJustDependsOnFiles(itemPath));
        } else if (item === 'just-depends-on.yml') {
            // Found a just-depends-on.yml file
            justFiles.push(itemPath);
        }
    });

    return justFiles;
};

export const parseDependencyGraph = (rootDir: string) => {
    const justFiles = scanForJustDependsOnFiles(rootDir);
    const subfolders: string[] = []
    justFiles.forEach((justFile) => {
        const subfolder = path.dirname(justFile);
        const folder = subfolder.replace(rootDir + "/", "")

        subfolders.push(folder)

    });

    // Build the dependency graph
    return buildDependencyGraph(subfolders, rootDir);
}
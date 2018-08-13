import fs = require('fs');
import path = require('path');
import util = require('util');

const exists = util.promisify(fs.exists);

/**
 * A single package's info
 */
export interface PackageInfo {
    /**
     * Package identifier (name + version)
     */
    identifier: string;

    /**
     * Package directory
     */
    directory: string;

    /**
     * package.json of the package
     */
    packageJson: any;

    /**
     * Path of including packages to this package
     */
    path: PackageInfo[];
}

export interface LocatePackagesOptions {
    /**
     * Directory to search in
     */
    directory: string;

    /**
     * Function to invoke for each package
     */
    callback: (info: PackageInfo) => Promise<void>;

    /**
     * Whether to include devDependencies on the top-level package.
     *
     * Will be switched off after the first recursion.
     */
    includeDevDependencies?: boolean;
}

/**
 * Recursively walk all packages
 */
export async function locatePackages(rootDirectory: string): Promise<PackageInfo[]> {
    const ret: PackageInfo[] = [];

    async function recurse(directory: string, includeDevDependencies: boolean, includers: PackageInfo[]) {
        const packageJson = require(path.resolve(directory, 'package.json'));

        const info: PackageInfo = {
            identifier: `${packageJson.name}@${packageJson.version}`,
            directory,
            packageJson,
            path: includers
        };
        ret.push(info);

        const depNames: string[] = [];
        depNames.push(...Object.keys(packageJson.dependencies || {}));
        if (includeDevDependencies) {
            depNames.push(...Object.keys(packageJson.devDependencies || {}));
        }

        for (const packageName of depNames) {
            const depDir = await findDependency(packageName, directory);
            await recurse(depDir, false, includers.concat([info]));
        }
    }

    await recurse(rootDirectory, true, []);

    return ret;
}

/**
 * Find dependency relative to the given directory
 *
 * Keep on searching node_modules directories up the tree until we find it;
 * not searching global packages, that's out of scope for the current
 * implementation.
 */
export async function findDependency(packageName: string, searchDirectory: string): Promise<string> {
    let dir = path.resolve(searchDirectory);
    while (true) {
        const dirPath = path.join(dir, 'node_modules', packageName);
        if (await exists(dirPath)) { return dirPath; }

        const newDir = path.dirname(dir);
        if (newDir === dir) {
            throw new Error(`${packageName} not found in ${searchDirectory}`);
        }
        dir = newDir;
    }
}
